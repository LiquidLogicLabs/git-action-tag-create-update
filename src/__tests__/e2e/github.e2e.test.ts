/**
 * E2E tests for GitHub platform
 * Tests the full action workflow with real GitHub API calls
 * 
 * Required environment variables:
 * - TEST_GITHUB_REPOSITORY: Repository in owner/repo format (e.g., "owner/repo")
 * - TEST_GITHUB_TOKEN: GitHub personal access token with repo scope
 * - TEST_TAG_PREFIX: Prefix for test tags (default: "test-")
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { run } from '../../index';
import { GitHubAPI } from '../../platforms/github';
import { Logger } from '../../logger';
import { RepositoryInfo, PlatformConfig } from '../../types';

// Mock @actions/core to capture outputs
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

describe('GitHub E2E Tests', () => {
  const repository = process.env.TEST_GITHUB_REPOSITORY;
  const token = process.env.TEST_GITHUB_TOKEN;
  const tagPrefix = process.env.TEST_TAG_PREFIX || 'test-';
  const uniqueId = Date.now().toString();
  
  let testTagName: string;
  let api: GitHubAPI;
  let repoInfo: RepositoryInfo;

  beforeAll(() => {
    // Prevent action from auto-running when imported
    process.env.SKIP_RUN = 'true';
    if (!repository || !token) {
      console.log('⚠️ Skipping GitHub E2E tests: TEST_GITHUB_REPOSITORY or TEST_GITHUB_TOKEN not set');
      return;
    }

    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid repository format: ${repository}. Expected "owner/repo"`);
    }

    repoInfo = {
      owner,
      repo,
      platform: 'github',
      url: `https://github.com/${owner}/${repo}.git`
    };

    const config: PlatformConfig = {
      type: 'github',
      token,
      baseUrl: 'https://api.github.com',
      ignoreCertErrors: false,
      verbose: true,
      pushTag: false
    };

    const logger = new Logger(true);
    api = new GitHubAPI(repoInfo, config, logger);
    testTagName = `${tagPrefix}${uniqueId}`;
  });

  afterEach(async () => {
    // Clean up test tags
    if (api && testTagName) {
      try {
        await api.deleteTag(testTagName);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  it('should create a new tag via GitHub API', async () => {
    if (!repository || !token) {
      return;
    }

    const tagName = `${testTagName}-create`;
    const tagMessage = 'E2E test: Create tag';
    
    // Get latest commit SHA
    const commitSha = await getLatestCommitSha(repoInfo);

    // Set up inputs
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'tag-name':
          return tagName;
        case 'tag-message':
          return tagMessage;
        case 'tag-sha':
          return commitSha;
        case 'repository':
          return repository;
        case 'token':
          return token;
        case 'repo-type':
          return 'github';
        default:
          return '';
      }
    });
    (core.getBooleanInput as jest.Mock).mockReturnValue(false);

    // Run the action
    await run();

    // Verify tag was created via API
    const exists = await api.tagExists(tagName);
    expect(exists).toBe(true);

    // Verify outputs
    expect(core.setOutput).toHaveBeenCalledWith('tag-name', tagName);
    expect(core.setOutput).toHaveBeenCalledWith('tag-created', 'true');
    expect(core.setOutput).toHaveBeenCalledWith('tag-exists', 'false');
    expect(core.setOutput).toHaveBeenCalledWith('platform', 'github');

    // Cleanup
    await api.deleteTag(tagName);
  });

  it('should update an existing tag via GitHub API', async () => {
    if (!repository || !token) {
      return;
    }

    const tagName = `${testTagName}-update`;
    const commitSha = await getLatestCommitSha(repoInfo);

    // Create initial tag
    await api.createTag({
      tagName,
      sha: commitSha,
      message: 'Initial tag',
      gpgSign: false,
      force: false,
      verbose: false
    });

    // Update the tag with new message
    const newMessage = 'E2E test: Updated tag';
    const newCommitSha = commitSha; // Use same SHA for update test

    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'tag-name':
          return tagName;
        case 'tag-message':
          return newMessage;
        case 'tag-sha':
          return newCommitSha;
        case 'repository':
          return repository;
        case 'token':
          return token;
        case 'repo-type':
          return 'github';
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

    // Run the action
    await run();

    // Verify outputs
    expect(core.setOutput).toHaveBeenCalledWith('tag-updated', 'true');
    expect(core.setOutput).toHaveBeenCalledWith('tag-exists', 'true');

    // Cleanup
    await api.deleteTag(tagName);
  });

  it('should detect platform automatically from repository URL', async () => {
    if (!repository || !token) {
      return;
    }

    const tagName = `${testTagName}-auto`;
    const commitSha = await getLatestCommitSha(repoInfo);

    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'tag-name':
          return tagName;
        case 'tag-message':
          return 'Auto-detect test';
        case 'tag-sha':
          return commitSha;
        case 'repository':
          return repository;
        case 'token':
          return token;
        case 'repo-type':
          return 'auto'; // Auto-detect
        default:
          return '';
      }
    });
    (core.getBooleanInput as jest.Mock).mockReturnValue(false);

    await run();

    // Verify platform was detected correctly
    expect(core.setOutput).toHaveBeenCalledWith('platform', 'github');
    expect(core.setFailed).not.toHaveBeenCalled();

    // Cleanup
    await api.deleteTag(tagName);
  });
});

/**
 * Get the latest commit SHA from a repository
 */
async function getLatestCommitSha(repoInfo: RepositoryInfo): Promise<string> {
  const output: string[] = [];
  await exec.exec('git', ['ls-remote', '--heads', `https://github.com/${repoInfo.owner}/${repoInfo.repo}.git`, 'main'], {
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        output.push(data.toString());
      }
    }
  });
  
  const sha = output.join('').split('\t')[0].trim();
  if (!sha || sha.length !== 40) {
    throw new Error(`Failed to get commit SHA from ${repoInfo.owner}/${repoInfo.repo}`);
  }
  return sha;
}
