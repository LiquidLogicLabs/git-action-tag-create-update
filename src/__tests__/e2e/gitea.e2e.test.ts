/**
 * E2E tests for Gitea platform
 * Tests the full action workflow with real Gitea API calls
 *
 * Defaults (LiquidLogicLabs):
 * - TEST_GITEA_REPOSITORY: liquidlogiclabs/git-action-release-tests (https://git.ravenwolf.org/liquidlogiclabs/git-action-release-tests)
 * - TEST_GITEA_TOKEN: falls back to GITEA_TOKEN when unset
 * - TEST_GITEA_BASE_URL: https://git.ravenwolf.org/api/v1 when using the default repo
 *
 * Override with environment variables:
 * - TEST_GITEA_REPOSITORY: Repository in owner/repo format
 * - TEST_GITEA_TOKEN or GITEA_TOKEN: Gitea personal access token with repo scope
 * - TEST_GITEA_BASE_URL: Gitea API base URL
 * - TEST_TAG_PREFIX: Prefix for test tags (default: "test-")
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { run } from '../../index';
import { GiteaAPI } from '../../platforms/gitea';
import { Logger } from '../../logger';
import { RepositoryInfo, PlatformConfig } from '../../types';

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setSecret: jest.fn()
}));

const DEFAULT_GITEA_REPO = 'liquidlogiclabs/git-action-release-tests';
const DEFAULT_GITEA_BASE_URL = 'https://git.ravenwolf.org/api/v1';

describe('Gitea E2E Tests', () => {
  const repository = process.env.TEST_GITEA_REPOSITORY || DEFAULT_GITEA_REPO;
  const token = process.env.TEST_GITEA_TOKEN || process.env.GITEA_TOKEN;
  const baseUrl =
    process.env.TEST_GITEA_BASE_URL ||
    (repository === DEFAULT_GITEA_REPO ? DEFAULT_GITEA_BASE_URL : 'https://gitea.com/api/v1');
  const tagPrefix = process.env.TEST_TAG_PREFIX || 'test-';
  const uniqueId = Date.now().toString();

  let testTagName: string;
  let api: GiteaAPI;
  let repoInfo: RepositoryInfo;
  let repoUrl: string;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(() => {
    // Prevent action from auto-running when imported
    process.env.SKIP_RUN = 'true';

    if (!token) {
      throw new Error('TEST_GITEA_TOKEN or GITEA_TOKEN required for e2e');
    }

    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid repository format: ${repository}. Expected "owner/repo"`);
    }

    // Extract host from base URL
    const urlMatch = baseUrl.match(/^(https?:\/\/[^/]+)/);
    const host = urlMatch ? urlMatch[1] : 'https://gitea.com';
    repoUrl = `${host}/${owner}/${repo}.git`;

    repoInfo = {
      owner,
      repo,
      platform: 'gitea',
      url: repoUrl
    };

    const config: PlatformConfig = {
      type: 'gitea',
      token,
      baseUrl,
      ignoreCertErrors: false,
      verbose: true,
      pushTag: false
    };

    const logger = new Logger(true);
    api = new GiteaAPI(repoInfo, config, logger);
    testTagName = `${tagPrefix}${uniqueId}`;
  });

  afterEach(async () => {
    if (api && testTagName) {
      try {
        await api.deleteTag(testTagName);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  it('should create a new tag via Gitea API', async () => {
    const tagName = `${testTagName}-create`;
    const commitSha = await getLatestCommitSha(repoInfo, repoUrl, token);

    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'tag-name':
          return tagName;
        case 'tag-message':
          return 'E2E test: Create tag';
        case 'tag-sha':
          return commitSha;
        case 'repository':
          return repository;
        case 'token':
          return token;
        case 'repo-type':
          return 'gitea';
        case 'base-url':
          return baseUrl;
        default:
          return '';
      }
    });
    (core.getBooleanInput as jest.Mock).mockReturnValue(false);

    await run();

    const exists = await api.tagExists(tagName);
    expect(exists).toBe(true);

    expect(core.setOutput).toHaveBeenCalledWith('tag-name', tagName);
    expect(core.setOutput).toHaveBeenCalledWith('tag-created', 'true');
    expect(core.setOutput).toHaveBeenCalledWith('platform', 'gitea');

    await api.deleteTag(tagName);
  });

  it('should update an existing tag via Gitea API', async () => {
    const tagName = `${testTagName}-update`;
    const commitSha = await getLatestCommitSha(repoInfo, repoUrl, token);

    await api.createTag({
      tagName,
      sha: commitSha,
      message: 'Initial tag',
    gpgSign: false,
      force: false,
      verbose: false
    });

    const preExists = await api.tagExists(tagName);
    expect(preExists).toBe(true);
    console.log(`Pre-update tagExists for ${tagName}: ${preExists}`);

    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'tag-name':
          return tagName;
        case 'tag-message':
          return 'E2E test: Updated tag';
        case 'tag-sha':
          return commitSha;
        case 'repository':
          return repository;
        case 'token':
          return token;
        case 'repo-type':
          return 'gitea';
        case 'base-url':
          return baseUrl;
        case 'update-existing':
          return 'true';
        case 'force':
          return 'true';
        default:
          return '';
      }
    });
    (core.getBooleanInput as jest.Mock).mockImplementation((name: string) => {
      return name === 'update-existing' || name === 'force' || name === 'verbose';
    });

    await run();

    const postExists = await api.tagExists(tagName);
    console.log(`Post-update tagExists for ${tagName}: ${postExists}`);
    console.log(`setOutput calls: ${JSON.stringify((core.setOutput as jest.Mock).mock.calls, null, 2)}`);
    console.log(`getBooleanInput calls: ${JSON.stringify((core.getBooleanInput as jest.Mock).mock.calls, null, 2)}`);
    console.log(`getInput calls: ${JSON.stringify((core.getInput as jest.Mock).mock.calls, null, 2)}`);

    expect(core.setOutput).toHaveBeenCalledWith('tag-updated', 'true');
    await api.deleteTag(tagName);
  });
});

async function getLatestCommitSha(
  repoInfo: RepositoryInfo,
  repoUrl: string,
  token?: string
): Promise<string> {
  let authUrl = repoUrl;
  if (token && repoUrl.startsWith('https://')) {
    const u = new URL(repoUrl);
    // Use token as password with a dummy username to satisfy basic auth
    u.username = 'token';
    u.password = token;
    authUrl = u.toString();
  }

  const output: string[] = [];
  await exec.exec('git', ['ls-remote', '--heads', authUrl, 'main'], {
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        output.push(data.toString());
      }
    }
  });
  
  const sha = output.join('').split('\t')[0].trim();
  if (!sha || sha.length !== 40) {
    throw new Error(`Failed to get commit SHA from ${repoUrl}`);
  }
  return sha;
}
