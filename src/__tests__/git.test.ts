import * as exec from '@actions/exec';
import * as io from '@actions/io';
import {
  isGitRepository,
  tagExistsLocally,
  getHeadSha,
  createTag,
  getTagSha,
  pushTag,
  deleteTagLocally,
  deleteTagRemote
} from '../git';
import { Logger } from '../logger';

// Mock dependencies
jest.mock('@actions/exec');
jest.mock('@actions/io');

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  logRequest: jest.fn(),
  logResponse: jest.fn(),
  logGitCommand: jest.fn(),
  logVerbose: jest.fn()
} as unknown as Logger;

describe('isGitRepository', () => {
  it('should return true if in git repository', async () => {
    (exec.exec as jest.Mock).mockResolvedValue(0);

    const result = await isGitRepository(mockLogger);
    expect(result).toBe(true);
    expect(exec.exec).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--git-dir'],
      expect.any(Object)
    );
  });

  it('should return false if not in git repository', async () => {
    (exec.exec as jest.Mock).mockResolvedValue(1);

    const result = await isGitRepository(mockLogger);
    expect(result).toBe(false);
  });
});

describe('tagExistsLocally', () => {
  it('should return true if tag exists', async () => {
    (exec.exec as jest.Mock).mockResolvedValue(0);

    const result = await tagExistsLocally('v1.0.0', mockLogger);
    expect(result).toBe(true);
    expect(exec.exec).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--verify', 'refs/tags/v1.0.0'],
      expect.any(Object)
    );
  });

  it('should return false if tag does not exist', async () => {
    (exec.exec as jest.Mock).mockResolvedValue(1);

    const result = await tagExistsLocally('v1.0.0', mockLogger);
    expect(result).toBe(false);
  });
});

describe('getHeadSha', () => {
  it('should return HEAD SHA', async () => {
    const output: string[] = [];
    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('abc123def456\n'));
      }
      return Promise.resolve(0);
    });

    const result = await getHeadSha(mockLogger);
    expect(result).toBe('abc123def456');
  });
});

describe('createTag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create annotated tag with message', async () => {
    (exec.exec as jest.Mock)
      .mockResolvedValueOnce(1) // tagExistsLocally returns false
      .mockResolvedValueOnce(0) // git tag succeeds
      .mockResolvedValueOnce(0); // getTagSha succeeds

    const output: string[] = [];
    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('tag-sha-123\n'));
        }
        return Promise.resolve(0);
      }
      if (command === 'git' && args[0] === 'tag') {
        return Promise.resolve(0);
      }
      return Promise.resolve(1);
    });

    const result = await createTag(
      {
        tagName: 'v1.0.0',
        sha: 'commit-sha',
        message: 'Release v1.0.0',
        gpgSign: false,
        force: false,
        verbose: false
      },
      mockLogger
    );

    expect(result.tagName).toBe('v1.0.0');
    expect(result.created).toBe(true);
  });

  it('should create lightweight tag without message', async () => {
    (exec.exec as jest.Mock)
      .mockResolvedValueOnce(1) // tagExistsLocally returns false
      .mockResolvedValueOnce(0) // git tag succeeds
      .mockResolvedValueOnce(0); // getTagSha succeeds

    const output: string[] = [];
    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('tag-sha-123\n'));
        }
        return Promise.resolve(0);
      }
      if (command === 'git' && args[0] === 'tag') {
        return Promise.resolve(0);
      }
      return Promise.resolve(1);
    });

    const result = await createTag(
      {
        tagName: 'v1.0.0',
        sha: 'commit-sha',
        gpgSign: false,
        force: false,
        verbose: false
      },
      mockLogger
    );

    expect(result.created).toBe(true);
  });

  it('should return existing tag info if tag exists and force is false', async () => {
    (exec.exec as jest.Mock).mockResolvedValue(0); // tagExistsLocally returns true

    const result = await createTag(
      {
        tagName: 'v1.0.0',
        sha: 'commit-sha',
        message: 'Release v1.0.0',
        gpgSign: false,
        force: false,
        verbose: false
      },
      mockLogger
    );

    expect(result.exists).toBe(true);
    expect(result.created).toBe(false);
  });

  it('should delete and recreate tag if force is true', async () => {
    (exec.exec as jest.Mock)
      .mockResolvedValueOnce(0) // tagExistsLocally returns true
      .mockResolvedValueOnce(0) // git tag -d succeeds
      .mockResolvedValueOnce(0) // git tag succeeds
      .mockResolvedValueOnce(0); // getTagSha succeeds

    const output: string[] = [];
    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('tag-sha-123\n'));
        }
        return Promise.resolve(0);
      }
      return Promise.resolve(0);
    });

    const result = await createTag(
      {
        tagName: 'v1.0.0',
        sha: 'commit-sha',
        message: 'Release v1.0.0',
        gpgSign: false,
        force: true,
        verbose: false
      },
      mockLogger
    );

    expect(result.updated).toBe(true);
  });

  it('should create GPG signed tag', async () => {
    (exec.exec as jest.Mock)
      .mockResolvedValueOnce(1) // tagExistsLocally returns false
      .mockResolvedValueOnce(0) // git tag -s succeeds
      .mockResolvedValueOnce(0); // getTagSha succeeds

    const output: string[] = [];
    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('tag-sha-123\n'));
        }
        return Promise.resolve(0);
      }
      if (command === 'git' && args[0] === 'tag') {
        // Verify -s flag is present
        expect(args).toContain('-s');
        return Promise.resolve(0);
      }
      return Promise.resolve(1);
    });

    await createTag(
      {
        tagName: 'v1.0.0',
        sha: 'commit-sha',
        message: 'Release v1.0.0',
        gpgSign: true,
        force: false,
        verbose: false
      },
      mockLogger
    );

    expect(exec.exec).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['-s', 'v1.0.0']),
      expect.any(Object)
    );
  });
});

describe('getTagSha', () => {
  it('should return tag SHA', async () => {
    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('tag-sha-123\n'));
      }
      return Promise.resolve(0);
    });

    const result = await getTagSha('v1.0.0', mockLogger);
    expect(result).toBe('tag-sha-123');
  });
});

describe('pushTag', () => {
  it('should push tag to remote', async () => {
    (exec.exec as jest.Mock)
      .mockResolvedValueOnce(0) // getRemoteUrl
      .mockResolvedValueOnce(0) // git remote set-url
      .mockResolvedValueOnce(0); // git push

    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'config') {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('https://github.com/owner/repo.git\n'));
        }
        return Promise.resolve(0);
      }
      return Promise.resolve(0);
    });

    await pushTag('v1.0.0', 'origin', 'token123', false, mockLogger);

    expect(exec.exec).toHaveBeenCalledWith(
      'git',
      ['push', 'origin', 'v1.0.0'],
      expect.any(Object)
    );
  });
});

describe('deleteTagLocally', () => {
  it('should delete local tag', async () => {
    (exec.exec as jest.Mock).mockResolvedValue(0);

    await deleteTagLocally('v1.0.0', mockLogger);

    expect(exec.exec).toHaveBeenCalledWith(
      'git',
      ['tag', '-d', 'v1.0.0'],
      expect.any(Object)
    );
  });
});

describe('deleteTagRemote', () => {
  it('should delete remote tag', async () => {
    (exec.exec as jest.Mock)
      .mockResolvedValueOnce(0) // getRemoteUrl
      .mockResolvedValueOnce(0) // git remote set-url
      .mockResolvedValueOnce(0); // git push --delete

    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'config') {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('https://github.com/owner/repo.git\n'));
        }
        return Promise.resolve(0);
      }
      return Promise.resolve(0);
    });

    await deleteTagRemote('v1.0.0', 'origin', 'token123', mockLogger);

    expect(exec.exec).toHaveBeenCalledWith(
      'git',
      ['push', 'origin', '--delete', 'v1.0.0'],
      expect.any(Object)
    );
  });
});

