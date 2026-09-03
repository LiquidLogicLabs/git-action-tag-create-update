import { GitHubAPI } from '../../platforms/github';
import { Logger } from '../../logger';
import { HttpClient } from '../../platforms/http-client';

// Mock HttpClient
jest.mock('../../platforms/http-client');

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

describe('GitHubAPI', () => {
  let api: GitHubAPI;
  let mockHttpClient: jest.Mocked<HttpClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      request: jest.fn()
    } as unknown as jest.Mocked<HttpClient>;

    (HttpClient as jest.Mock).mockImplementation(() => mockHttpClient);

    api = new GitHubAPI(
      { owner: 'owner', repo: 'repo', platform: 'github' },
      {
        type: 'github',
        token: 'test-token',
        ignoreCertErrors: false,
        verbose: false
      },
      mockLogger
    );
  });

  describe('tagExists', () => {
    it('should return true if tag exists', async () => {
      mockHttpClient.get.mockResolvedValue({ ref: 'refs/tags/v1.0.0' });

      const result = await api.tagExists('v1.0.0');
      expect(result).toBe(true);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/repos/owner/repo/git/refs/tags/v1.0.0'
      );
    });

    it('returns false when only a longer tag shares the prefix', async () => {
      // GitHub answers GET /git/refs/tags/v1 with an array containing refs/tags/v1.2.3.
      // A 200 there does not mean v1 exists.
      mockHttpClient.get.mockResolvedValue([
        { ref: 'refs/tags/v1.2.3', object: { sha: 'abc' } }
      ]);

      const result = await api.tagExists('v1');
      expect(result).toBe(false);
    });

    it('returns true when the exact tag is among several prefix matches', async () => {
      mockHttpClient.get.mockResolvedValue([
        { ref: 'refs/tags/v1.2.3', object: { sha: 'abc' } },
        { ref: 'refs/tags/v1', object: { sha: 'def' } }
      ]);

      const result = await api.tagExists('v1');
      expect(result).toBe(true);
    });

    it('should return false if tag does not exist', async () => {
      const error = new Error('HTTP 404 Not Found');
      error.message = 'HTTP 404 Not Found';
      mockHttpClient.get.mockRejectedValue(error);

      const result = await api.tagExists('v1.0.0');
      expect(result).toBe(false);
    });

    it('should throw error for non-404 errors', async () => {
      const error = new Error('HTTP 500 Internal Server Error');
      mockHttpClient.get.mockRejectedValue(error);

      await expect(api.tagExists('v1.0.0')).rejects.toThrow('500');
    });
  });

  describe('createTag', () => {
    it('should create a new tag', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('HTTP 404 Not Found'));
      mockHttpClient.post
        .mockResolvedValueOnce({ sha: 'tag-sha-123' })
        .mockResolvedValueOnce(undefined);

      const result = await api.createTag({
        tagName: 'v1.0.0',
        sha: 'commit-sha-123',
        message: 'Release v1.0.0',
        gpgSign: false,
        force: false,
        verbose: false
      });

      expect(result.tagName).toBe('v1.0.0');
      expect(result.sha).toBe('commit-sha-123');
      expect(result.created).toBe(true);
      expect(result.exists).toBe(false);
      expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
    });

    it('should return existing tag info if tag exists and force is false', async () => {
      mockHttpClient.get.mockResolvedValue({ ref: 'refs/tags/v1.0.0' });

      const result = await api.createTag({
        tagName: 'v1.0.0',
        sha: 'commit-sha-123',
        message: 'Release v1.0.0',
        gpgSign: false,
        force: false,
        verbose: false
      });

      expect(result.exists).toBe(true);
      expect(result.created).toBe(false);
      expect(mockHttpClient.post).not.toHaveBeenCalled();
    });

    it('should delete and recreate tag if force is true', async () => {
      mockHttpClient.get.mockResolvedValue({ ref: 'refs/tags/v1.0.0' });
      mockHttpClient.delete.mockResolvedValue(undefined);
      mockHttpClient.post
        .mockResolvedValueOnce({ sha: 'tag-sha-123' })
        .mockResolvedValueOnce(undefined);

      const result = await api.createTag({
        tagName: 'v1.0.0',
        sha: 'commit-sha-123',
        message: 'Release v1.0.0',
        gpgSign: false,
        force: true,
        verbose: false
      });

      expect(result.updated).toBe(true);
      expect(mockHttpClient.delete).toHaveBeenCalled();
      expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateTag', () => {
    it('should delete and recreate tag', async () => {
      mockHttpClient.delete.mockResolvedValue(undefined);
      mockHttpClient.get.mockRejectedValue(new Error('HTTP 404 Not Found'));
      mockHttpClient.post
        .mockResolvedValueOnce({ sha: 'tag-sha-123' })
        .mockResolvedValueOnce(undefined);

      const result = await api.updateTag({
        tagName: 'v1.0.0',
        sha: 'commit-sha-123',
        message: 'Updated release',
        gpgSign: false,
        force: false,
        verbose: false
      });

      // updateTag reports an update, not a creation. The previous expectation here
      // (updated:false, created:true) contradicted both e2e suites, which assert the
      // action sets tag-updated=true on this path.
      expect(result.updated).toBe(true);
      expect(result.created).toBe(false);
      expect(mockHttpClient.delete).toHaveBeenCalled();
    });
  });

  describe('deleteTag', () => {
    it('should delete tag', async () => {
      mockHttpClient.delete.mockResolvedValue(undefined);

      await api.deleteTag('v1.0.0');

      expect(mockHttpClient.delete).toHaveBeenCalledWith(
        '/repos/owner/repo/git/refs/tags/v1.0.0'
      );
    });

    it('should handle 404 gracefully', async () => {
      const error = new Error('HTTP 404 Not Found');
      mockHttpClient.delete.mockRejectedValue(error);

      await expect(api.deleteTag('v1.0.0')).resolves.not.toThrow();
    });

    it('treats 422 "Reference does not exist" as already gone', async () => {
      // GitHub answers a delete of a missing ref with 422, not 404.
      mockHttpClient.delete.mockRejectedValue(
        new Error('HTTP 422 Unprocessable Entity: {"message":"Reference does not exist"}')
      );

      await expect(api.deleteTag('v1.0.0')).resolves.toBeUndefined();
    });

    it('still throws on a 422 that is not a missing reference', async () => {
      mockHttpClient.delete.mockRejectedValue(
        new Error('HTTP 422 Unprocessable Entity: {"message":"Validation failed"}')
      );

      await expect(api.deleteTag('v1.0.0')).rejects.toThrow(/422/);
    });

    it('should throw non-404 errors', async () => {
      const error = new Error('HTTP 500 Internal Server Error');
      mockHttpClient.delete.mockRejectedValue(error);

      await expect(api.deleteTag('v1.0.0')).rejects.toThrow('500');
    });
  });

  describe('updateTag', () => {
    const opts = {
      tagName: 'v1',
      sha: 'newsha',
      message: 'new',
      gpgSign: false,
      force: true,
      verbose: false
    };

    it('restores the previous tag when recreation fails', async () => {
      mockHttpClient.get.mockResolvedValue([
        { ref: 'refs/tags/v1', object: { sha: 'oldtagsha' } }
      ]);
      mockHttpClient.delete.mockResolvedValue(undefined);
      mockHttpClient.post.mockRejectedValue(new Error('HTTP 500 Internal Server Error'));

      await expect(api.updateTag(opts)).rejects.toThrow(/500/);

      // The ref must be put back where it was, not left deleted.
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/repos/owner/repo/git/refs',
        expect.objectContaining({ ref: 'refs/tags/v1', sha: 'oldtagsha' })
      );
    });
  });
});
