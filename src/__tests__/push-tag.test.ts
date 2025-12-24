import { GenericGitAPI } from '../platforms/generic';
import { Logger } from '../logger';
import { pushTag, createTag as createTagLocal } from '../git';

// Mock git module
jest.mock('../git', () => ({
  tagExistsLocally: jest.fn().mockResolvedValue(false),
  createTag: jest.fn(),
  pushTag: jest.fn(),
  deleteTagRemote: jest.fn(),
  deleteTagLocally: jest.fn(),
  getHeadSha: jest.fn().mockResolvedValue('abc123def456')
}));

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

describe('push_tag functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GenericGitAPI with pushTag', () => {
    it('should push tag when pushTag is true (default)', async () => {
      const api = new GenericGitAPI(
        {
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          platform: 'generic'
        },
        {
          type: 'generic',
          token: 'test-token',
          ignoreCertErrors: false,
          verbose: false,
          pushTag: true
        },
        mockLogger
      );

      (createTagLocal as jest.Mock).mockResolvedValue({
        tagName: 'v1.0.0',
        sha: 'abc123',
        exists: false,
        created: true,
        updated: false
      });

      await api.createTag({
        tagName: 'v1.0.0',
        sha: 'abc123',
        message: 'Test tag',
        gpgSign: false,
        force: false,
        verbose: false
      });

      expect(pushTag).toHaveBeenCalledWith(
        'v1.0.0',
        'origin',
        'test-token',
        false,
        mockLogger
      );
    });

    it('should not push tag when pushTag is false', async () => {
      const api = new GenericGitAPI(
        {
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          platform: 'generic'
        },
        {
          type: 'generic',
          token: 'test-token',
          ignoreCertErrors: false,
          verbose: false,
          pushTag: false
        },
        mockLogger
      );

      (createTagLocal as jest.Mock).mockResolvedValue({
        tagName: 'v1.0.0',
        sha: 'abc123',
        exists: false,
        created: true,
        updated: false
      });

      await api.createTag({
        tagName: 'v1.0.0',
        sha: 'abc123',
        message: 'Test tag',
        gpgSign: false,
        force: false,
        verbose: false
      });

      expect(pushTag).not.toHaveBeenCalled();
    });

    it('should not push tag when no remote URL exists', async () => {
      const api = new GenericGitAPI(
        {
          owner: 'owner',
          repo: 'repo',
          platform: 'generic'
          // No url property
        },
        {
          type: 'generic',
          token: 'test-token',
          ignoreCertErrors: false,
          verbose: false,
          pushTag: true
        },
        mockLogger
      );

      (createTagLocal as jest.Mock).mockResolvedValue({
        tagName: 'v1.0.0',
        sha: 'abc123',
        exists: false,
        created: true,
        updated: false
      });

      await api.createTag({
        tagName: 'v1.0.0',
        sha: 'abc123',
        message: 'Test tag',
        gpgSign: false,
        force: false,
        verbose: false
      });

      expect(pushTag).not.toHaveBeenCalled();
    });

    it('should push tag when pushTag is undefined (defaults to true)', async () => {
      const api = new GenericGitAPI(
        {
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          platform: 'generic'
        },
        {
          type: 'generic',
          token: 'test-token',
          ignoreCertErrors: false,
          verbose: false
          // pushTag not specified, should default to true
        },
        mockLogger
      );

      (createTagLocal as jest.Mock).mockResolvedValue({
        tagName: 'v1.0.0',
        sha: 'abc123',
        exists: false,
        created: true,
        updated: false
      });

      await api.createTag({
        tagName: 'v1.0.0',
        sha: 'abc123',
        message: 'Test tag',
        gpgSign: false,
        force: false,
        verbose: false
      });

      expect(pushTag).toHaveBeenCalled();
    });
  });
});

