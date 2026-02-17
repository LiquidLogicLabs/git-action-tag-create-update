/**
 * E2E tests for Bitbucket platform
 * Tests the full action workflow with real Bitbucket API calls
 *
 * Skipped for now (see describe.skip below). Re-enable when Bitbucket e2e is needed.
 *
 * Required environment variables:
 * - TEST_BITBUCKET_REPOSITORY: Repository in owner/repo format (e.g., "owner/repo")
 * - TEST_BITBUCKET_TOKEN: Bitbucket app password or access token
 * - TEST_BITBUCKET_BASE_URL: Bitbucket base URL (optional, defaults to cloud)
 * - TEST_TAG_PREFIX: Prefix for test tags (default: "test-")
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { run } from '../../index';
import { BitbucketAPI } from '../../platforms/bitbucket';
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

describe.skip('Bitbucket E2E Tests', () => {
  const repository = process.env.TEST_BITBUCKET_REPOSITORY;
  const token = process.env.TEST_BITBUCKET_TOKEN;
  const baseUrl = process.env.TEST_BITBUCKET_BASE_URL || 'https://api.bitbucket.org/2.0';
  const tagPrefix = process.env.TEST_TAG_PREFIX || 'test-';
  const uniqueId = Date.now().toString();
  
  let testTagName: string;
  let api: BitbucketAPI;
  let repoInfo: RepositoryInfo;
  let repoUrl: string;

  beforeAll(() => {
    // Prevent action from auto-running when imported
    process.env.SKIP_RUN = 'true';
    
    if (!repository || !token) {
      throw new Error('TEST_BITBUCKET_REPOSITORY and TEST_BITBUCKET_TOKEN required for e2e');
    }

    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid repository format: ${repository}. Expected "owner/repo"`);
    }

    const urlMatch = baseUrl.match(/^(https?:\/\/[^/]+)/);
    const host = urlMatch ? urlMatch[1].replace('api.', '') : 'https://bitbucket.org';
    repoUrl = `${host}/${owner}/${repo}.git`;

    repoInfo = {
      owner,
      repo,
      platform: 'bitbucket',
      url: repoUrl
    };

    const config: PlatformConfig = {
      type: 'bitbucket',
      token,
      baseUrl,
      ignoreCertErrors: false,
      verbose: true,
      pushTag: false
    };

    const logger = new Logger(true);
    api = new BitbucketAPI(repoInfo, config, logger);
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

  it('should create a new tag via Bitbucket API', async () => {
    const tagName = `${testTagName}-create`;
    const commitSha = await getLatestCommitSha(repoInfo, repoUrl);

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
          return 'bitbucket';
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
    expect(core.setOutput).toHaveBeenCalledWith('platform', 'bitbucket');

    await api.deleteTag(tagName);
  });

  it('should update an existing tag via Bitbucket API', async () => {
    const tagName = `${testTagName}-update`;
    const commitSha = await getLatestCommitSha(repoInfo, repoUrl);

    await api.createTag({
      tagName,
      sha: commitSha,
      message: 'Initial tag',
    gpgSign: false,
      force: false,
      verbose: false
    });

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
          return 'bitbucket';
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

    expect(core.setOutput).toHaveBeenCalledWith('tag-updated', 'true');
    await api.deleteTag(tagName);
  });
});

async function getLatestCommitSha(repoInfo: RepositoryInfo, repoUrl: string): Promise<string> {
  const output: string[] = [];
  await exec.exec('git', ['ls-remote', '--heads', repoUrl, 'main'], {
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
