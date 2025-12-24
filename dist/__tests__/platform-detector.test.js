"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const platform_detector_1 = require("../platform-detector");
const exec = __importStar(require("@actions/exec"));
const io = __importStar(require("@actions/io"));
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
};
describe('parseRepository', () => {
    it('should parse GitHub URL', () => {
        const result = (0, platform_detector_1.parseRepository)('https://github.com/owner/repo', mockLogger);
        expect(result).toEqual({
            owner: 'owner',
            repo: 'repo',
            url: 'https://github.com/owner/repo',
            platform: 'github'
        });
    });
    it('should parse GitHub URL with .git suffix', () => {
        const result = (0, platform_detector_1.parseRepository)('https://github.com/owner/repo.git', mockLogger);
        expect(result).toEqual({
            owner: 'owner',
            repo: 'repo',
            url: 'https://github.com/owner/repo.git',
            platform: 'github'
        });
    });
    it('should parse Gitea URL', () => {
        const result = (0, platform_detector_1.parseRepository)('https://gitea.com/owner/repo', mockLogger);
        expect(result).toEqual({
            owner: 'owner',
            repo: 'repo',
            url: 'https://gitea.com/owner/repo',
            platform: 'gitea'
        });
    });
    it('should parse Bitbucket URL', () => {
        const result = (0, platform_detector_1.parseRepository)('https://bitbucket.org/owner/repo', mockLogger);
        expect(result).toEqual({
            owner: 'owner',
            repo: 'repo',
            url: 'https://bitbucket.org/owner/repo',
            platform: 'bitbucket'
        });
    });
    it('should parse owner/repo format', () => {
        const result = (0, platform_detector_1.parseRepository)('owner/repo', mockLogger);
        expect(result).toEqual({
            owner: 'owner',
            repo: 'repo',
            platform: 'auto'
        });
    });
    it('should return undefined for invalid format', () => {
        const result = (0, platform_detector_1.parseRepository)('invalid', mockLogger);
        expect(result).toBeUndefined();
    });
    it('should handle GitHub Enterprise URL', () => {
        const result = (0, platform_detector_1.parseRepository)('https://github.enterprise.com/owner/repo', mockLogger);
        expect(result?.platform).toBe('github');
    });
});
describe('detectPlatform', () => {
    it('should use explicit repo_type if not auto', () => {
        const result = (0, platform_detector_1.detectPlatform)('github', undefined, mockLogger);
        expect(result).toBe('github');
    });
    it('should detect from repository info', () => {
        const repoInfo = {
            owner: 'owner',
            repo: 'repo',
            platform: 'gitea'
        };
        const result = (0, platform_detector_1.detectPlatform)('auto', repoInfo, mockLogger);
        expect(result).toBe('gitea');
    });
    it('should detect GitHub from GITHUB_REPOSITORY env', () => {
        const originalEnv = process.env.GITHUB_REPOSITORY;
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        const result = (0, platform_detector_1.detectPlatform)('auto', undefined, mockLogger);
        expect(result).toBe('github');
        process.env.GITHUB_REPOSITORY = originalEnv;
    });
    it('should fallback to generic', () => {
        const originalEnv = process.env.GITHUB_REPOSITORY;
        delete process.env.GITHUB_REPOSITORY;
        const result = (0, platform_detector_1.detectPlatform)('auto', undefined, mockLogger);
        expect(result).toBe('generic');
        process.env.GITHUB_REPOSITORY = originalEnv;
    });
});
describe('getRepositoryInfo', () => {
    const originalEnv = process.env;
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
    });
    afterEach(() => {
        process.env = originalEnv;
    });
    it('should parse provided repository URL', async () => {
        io.which.mockResolvedValue('/usr/bin/git');
        const result = await (0, platform_detector_1.getRepositoryInfo)('https://github.com/owner/repo', 'auto', mockLogger);
        expect(result.owner).toBe('owner');
        expect(result.repo).toBe('repo');
        expect(result.platform).toBe('github');
    });
    it('should use GITHUB_REPOSITORY if no repository provided', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        io.which.mockResolvedValue('/usr/bin/git');
        exec.exec.mockResolvedValue(0);
        const result = await (0, platform_detector_1.getRepositoryInfo)(undefined, 'auto', mockLogger);
        expect(result.owner).toBe('owner');
        expect(result.repo).toBe('repo');
        expect(result.platform).toBe('github');
    });
    it('should throw error if no repository info available', async () => {
        delete process.env.GITHUB_REPOSITORY;
        io.which.mockResolvedValue('/usr/bin/git');
        exec.exec.mockResolvedValue(1); // Not a git repo
        await expect((0, platform_detector_1.getRepositoryInfo)(undefined, 'auto', mockLogger)).rejects.toThrow('Could not determine repository information');
    });
    it('should use explicit repo_type', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        io.which.mockResolvedValue('/usr/bin/git');
        exec.exec.mockResolvedValue(0);
        const result = await (0, platform_detector_1.getRepositoryInfo)(undefined, 'gitea', mockLogger);
        expect(result.platform).toBe('gitea');
    });
});
//# sourceMappingURL=platform-detector.test.js.map