"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const github_1 = require("../../platforms/github");
const http_client_1 = require("../../platforms/http-client");
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
};
describe('GitHubAPI', () => {
    let api;
    let mockHttpClient;
    beforeEach(() => {
        jest.clearAllMocks();
        mockHttpClient = {
            get: jest.fn(),
            post: jest.fn(),
            delete: jest.fn(),
            request: jest.fn()
        };
        http_client_1.HttpClient.mockImplementation(() => mockHttpClient);
        api = new github_1.GitHubAPI({ owner: 'owner', repo: 'repo', platform: 'github' }, {
            type: 'github',
            token: 'test-token',
            ignoreCertErrors: false,
            verbose: false
        }, mockLogger);
    });
    describe('tagExists', () => {
        it('should return true if tag exists', async () => {
            mockHttpClient.get.mockResolvedValue({ ref: 'refs/tags/v1.0.0' });
            const result = await api.tagExists('v1.0.0');
            expect(result).toBe(true);
            expect(mockHttpClient.get).toHaveBeenCalledWith('/repos/owner/repo/git/refs/tags/v1.0.0');
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
            expect(result.updated).toBe(false);
            expect(result.created).toBe(true);
            expect(mockHttpClient.delete).toHaveBeenCalled();
        });
    });
    describe('deleteTag', () => {
        it('should delete tag', async () => {
            mockHttpClient.delete.mockResolvedValue(undefined);
            await api.deleteTag('v1.0.0');
            expect(mockHttpClient.delete).toHaveBeenCalledWith('/repos/owner/repo/git/refs/tags/v1.0.0');
        });
        it('should handle 404 gracefully', async () => {
            const error = new Error('HTTP 404 Not Found');
            mockHttpClient.delete.mockRejectedValue(error);
            await expect(api.deleteTag('v1.0.0')).resolves.not.toThrow();
        });
        it('should throw non-404 errors', async () => {
            const error = new Error('HTTP 500 Internal Server Error');
            mockHttpClient.delete.mockRejectedValue(error);
            await expect(api.deleteTag('v1.0.0')).rejects.toThrow('500');
        });
    });
});
//# sourceMappingURL=github.test.js.map