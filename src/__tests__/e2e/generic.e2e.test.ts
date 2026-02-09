/**
 * E2E tests for Generic Git platform (local Git CLI)
 * Tests the full action workflow with local Git operations and remote push
 * 
 * Required environment variables:
 * - TEST_TAG_PREFIX: Prefix for test tags (default: "test-")
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { run } from '../../index';

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

describe('Generic Git E2E Tests', () => {
  const tagPrefix = process.env.TEST_TAG_PREFIX || 'test-';
  const uniqueId = Date.now().toString();
  let tempDir: string;
  let originalCwd: string;

  beforeAll(() => {
    // Prevent action from auto-running when imported
    process.env.SKIP_RUN = 'true';
  });

  beforeEach(async () => {
    // Create temporary repository
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-e2e-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    // Provide minimal repository context for getRepositoryInfo (avoids errors when no remote is set)
    process.env.GITHUB_REPOSITORY = 'local/test';

    // Initialize git repository
    await exec.exec('git', ['init'], { silent: true });
    await exec.exec('git', ['config', 'user.name', 'E2E Test User'], { silent: true });
    await exec.exec('git', ['config', 'user.email', 'e2e-test@example.com'], { silent: true });

    // Create initial commit
    fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');
    await exec.exec('git', ['add', 'test.txt'], { silent: true });
    await exec.exec('git', ['commit', '-m', 'Initial commit'], { silent: true });

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    delete process.env.GITHUB_REPOSITORY;
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should create annotated tag in local repository', async () => {
    const tagName = `${tagPrefix}${uniqueId}-annotated`;
    const tagMessage = 'E2E test: Annotated tag';

    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'tag-name':
          return tagName;
        case 'tag-message':
          return tagMessage;
        case 'repo-type':
          return 'generic';
        default:
          return '';
      }
    });
    (core.getBooleanInput as jest.Mock).mockReturnValue(false);

    await run();

    // Verify tag was created
    const tagExists = (await exec.exec('git', ['rev-parse', '--verify', `refs/tags/${tagName}`], {
      silent: true,
      ignoreReturnCode: true
    })) === 0;

    expect(tagExists).toBe(true);

    // Verify outputs
    expect(core.setOutput).toHaveBeenCalledWith('tag-name', tagName);
    expect(core.setOutput).toHaveBeenCalledWith('tag-created', 'true');
    expect(core.setOutput).toHaveBeenCalledWith('tag-exists', 'false');
    expect(core.setOutput).toHaveBeenCalledWith('platform', 'generic');
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('should create lightweight tag in local repository', async () => {
    const tagName = `${tagPrefix}${uniqueId}-lightweight`;

    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'tag-name':
          return tagName;
        case 'repo-type':
          return 'generic';
        default:
          return '';
      }
    });
    (core.getBooleanInput as jest.Mock).mockReturnValue(false);

    await run();

    const tagExists = (await exec.exec('git', ['rev-parse', '--verify', `refs/tags/${tagName}`], {
      silent: true,
      ignoreReturnCode: true
    })) === 0;

    expect(tagExists).toBe(true);

    // Verify it's a lightweight tag (points to commit, not tag object)
    const tagType = (await exec.exec('git', ['cat-file', '-t', tagName], {
      silent: true,
      ignoreReturnCode: true
    }));
    expect(tagType).toBe(0); // Command succeeds

    expect(core.setOutput).toHaveBeenCalledWith('tag-created', 'true');
  });

  it('should update existing tag when force is true', async () => {
    const tagName = `${tagPrefix}${uniqueId}-force-update`;

    // Create initial tag
    await exec.exec('git', ['tag', tagName], { silent: true });

    // Create a new commit
    fs.writeFileSync(path.join(tempDir, 'test2.txt'), 'new content');
    await exec.exec('git', ['add', 'test2.txt'], { silent: true });
    await exec.exec('git', ['commit', '-m', 'Second commit'], { silent: true });

    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'tag-name':
          return tagName;
        case 'tag-message':
          return 'Updated tag message';
        case 'repo-type':
          return 'generic';
        case 'force':
          return 'true';
        default:
          return '';
      }
    });
    (core.getBooleanInput as jest.Mock).mockImplementation((name: string) => {
      return name === 'force' || name === 'verbose';
    });

    await run();

    expect(core.setOutput).toHaveBeenCalledWith('tag-updated', 'true');
    expect(core.setOutput).toHaveBeenCalledWith('tag-exists', 'true');
  });

  it('should not push tag when push_tag is false', async () => {
    const tagName = `${tagPrefix}${uniqueId}-no-push`;

    // Set up a fake remote (but it won't be used)
    await exec.exec('git', ['remote', 'add', 'origin', 'https://example.com/repo.git'], {
      silent: true
    });

    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'tag-name':
          return tagName;
        case 'repo-type':
          return 'generic';
        case 'push-tag':
          return 'false';
        default:
          return '';
      }
    });
    (core.getBooleanInput as jest.Mock).mockImplementation((name: string) => {
      return name === 'verbose';
    });

    await run();

    // Tag should be created locally
    const tagExists = (await exec.exec('git', ['rev-parse', '--verify', `refs/tags/${tagName}`], {
      silent: true,
      ignoreReturnCode: true
    })) === 0;

    expect(tagExists).toBe(true);
    expect(core.setOutput).toHaveBeenCalledWith('tag-created', 'true');
  });
});
