import * as exec from '@actions/exec';
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
    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        if (args[1] === '--verify' && args[2]?.includes('refs/tags/')) {
          // tagExistsLocally - return 1 (not found)
          return Promise.resolve(1);
        }
        // getTagSha or other rev-parse
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('tag-sha-123\n'));
        }
        return Promise.resolve(0);
      }
      if (command === 'git' && args[0] === 'config' && args[1] === '--get') {
        // Return 1 (not found) for user.name and user.email checks
        return Promise.resolve(1);
      }
      if (command === 'git' && args[0] === 'config' && args[1] === '--local') {
        // Config set succeeds
        return Promise.resolve(0);
      }
      if (command === 'git' && args[0] === 'tag') {
        // Validate git tag command structure
        // args[0] is 'tag', so 'tag' is the first element
        expect(args[0]).toBe('tag');
        
        // Verify -a flag is present for annotated tags
        expect(args).toContain('-a');
        
        // Verify -F - is present to read message from stdin
        expect(args).toContain('-F');
        const fIndex = args.indexOf('-F');
        expect(args[fIndex + 1]).toBe('-');
        
        // Verify message is provided via stdin
        expect(options?.input).toBeInstanceOf(Buffer);
        const message = options.input.toString();
        expect(message).toBe('Release v1.0.0');
        
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
    
    // Verify the exact git command arguments
    expect(exec.exec).toHaveBeenCalledWith(
      'git',
      ['tag', '-a', '-F', '-', 'v1.0.0', 'commit-sha'],
      expect.objectContaining({
        input: expect.any(Buffer)
      })
    );
  });

  it('should create lightweight tag without message', async () => {
    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        if (args[1] === '--verify' && args[2]?.includes('refs/tags/')) {
          // tagExistsLocally - return 1 (not found)
          return Promise.resolve(1);
        }
        if (args[1] === '--verify' || args.length === 2) {
          // getTagSha
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from('tag-sha-123\n'));
          }
          return Promise.resolve(0);
        }
        // getHeadSha or other
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

  it('should create lightweight tag when message is empty string', async () => {
    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        if (args[1] === '--verify' && args[2]?.includes('refs/tags/')) {
          // tagExistsLocally - return 1 (not found)
          return Promise.resolve(1);
        }
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('tag-sha-123\n'));
        }
        return Promise.resolve(0);
      }
      if (command === 'git' && args[0] === 'tag') {
        // Verify -a flag is NOT present (lightweight tag)
        expect(args).not.toContain('-a');
        return Promise.resolve(0);
      }
      return Promise.resolve(1);
    });

    const result = await createTag(
      {
        tagName: 'v1.0.0',
        sha: 'commit-sha',
        message: '',
        gpgSign: false,
        force: false,
        verbose: false
      },
      mockLogger
    );

    expect(result.created).toBe(true);
  });

  it('should create lightweight tag when message is whitespace-only', async () => {
    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        if (args[1] === '--verify' && args[2]?.includes('refs/tags/')) {
          // tagExistsLocally - return 1 (not found)
          return Promise.resolve(1);
        }
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('tag-sha-123\n'));
        }
        return Promise.resolve(0);
      }
      if (command === 'git' && args[0] === 'tag') {
        // Verify -a flag is NOT present (lightweight tag)
        expect(args).not.toContain('-a');
        return Promise.resolve(0);
      }
      return Promise.resolve(1);
    });

    const result = await createTag(
      {
        tagName: 'v1.0.0',
        sha: 'commit-sha',
        message: '   \n\t  ',
        gpgSign: false,
        force: false,
        verbose: false
      },
      mockLogger
    );

    expect(result.created).toBe(true);
  });

  it('should preserve multi-line messages', async () => {
    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        if (args[1] === '--verify' && args[2]?.includes('refs/tags/')) {
          return Promise.resolve(1);
        }
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('tag-sha-123\n'));
        }
        return Promise.resolve(0);
      }
      if (command === 'git' && args[0] === 'config' && args[1] === '--get') {
        return Promise.resolve(1);
      }
      if (command === 'git' && args[0] === 'config' && args[1] === '--local') {
        return Promise.resolve(0);
      }
      if (command === 'git' && args[0] === 'tag') {
        // Verify -a flag is present (annotated tag)
        expect(args).toContain('-a');
        // Verify message is passed via stdin
        expect(options?.input).toBeInstanceOf(Buffer);
        const message = options.input.toString();
        expect(message).toContain('Line 1');
        expect(message).toContain('Line 2');
        return Promise.resolve(0);
      }
      return Promise.resolve(1);
    });

    const multiLineMessage = 'Line 1\n\nLine 2';
    const result = await createTag(
      {
        tagName: 'v1.0.0',
        sha: 'commit-sha',
        message: multiLineMessage,
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
      .mockResolvedValueOnce(1) // git config --get user.name returns false (not set)
      .mockResolvedValueOnce(1) // git config --get user.email returns false (not set)
      .mockResolvedValueOnce(0) // git config --local user.name succeeds
      .mockResolvedValueOnce(0) // git config --local user.email succeeds
      .mockResolvedValueOnce(0) // git tag succeeds
      .mockResolvedValueOnce(0); // getTagSha succeeds

    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        if (args[1] === '--verify') {
          // tagExistsLocally or getTagSha
          if (options?.listeners?.stdout) {
            options.listeners.stdout(Buffer.from('tag-sha-123\n'));
          }
          return Promise.resolve(0);
        }
        // getHeadSha or other rev-parse
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('tag-sha-123\n'));
        }
        return Promise.resolve(0);
      }
      if (command === 'git' && args[0] === 'config' && args[1] === '--get') {
        // Return 1 (not found) for user.name and user.email checks
        return Promise.resolve(1);
      }
      if (command === 'git' && args[0] === 'config' && args[1] === '--local') {
        // Config set succeeds
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
    (exec.exec as jest.Mock).mockImplementation((command, args, options) => {
      if (command === 'git' && args[0] === 'rev-parse') {
        if (args[1] === '--verify' && args[2]?.includes('refs/tags/')) {
          // tagExistsLocally - return 1 (not found)
          return Promise.resolve(1);
        }
        // getTagSha or other rev-parse
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('tag-sha-123\n'));
        }
        return Promise.resolve(0);
      }
      if (command === 'git' && args[0] === 'config' && args[1] === '--get') {
        // Return 1 (not found) for user.name and user.email checks
        return Promise.resolve(1);
      }
      if (command === 'git' && args[0] === 'config' && args[1] === '--local') {
        // Config set succeeds
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

    // Fully qualified on both sides, deliberately. Pushing the bare tag name let a name
    // like "+main" be parsed as a refspec and force-update the remote BRANCH.
    expect(exec.exec).toHaveBeenCalledWith(
      'git',
      ['push', 'origin', 'refs/tags/v1.0.0:refs/tags/v1.0.0'],
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

