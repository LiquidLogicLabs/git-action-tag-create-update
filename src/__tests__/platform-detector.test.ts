import { parseRepository, detectPlatform, getRepositoryInfo } from '../platform-detector';
import { Logger } from '../logger';
import * as exec from '@actions/exec';
import * as io from '@actions/io';

// Mock dependencies
jest.mock('@actions/exec');
jest.mock('@actions/io');

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  verbose: false
} as unknown as Logger;

describe('parseRepository', () => {
  it('should parse GitHub URL', () => {
    const result = parseRepository('https://github.com/owner/repo', mockLogger);
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      url: 'https://github.com/owner/repo',
      platform: 'github'
    });
  });

  it('should parse GitHub URL with .git suffix', () => {
    const result = parseRepository('https://github.com/owner/repo.git', mockLogger);
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      url: 'https://github.com/owner/repo.git',
      platform: 'github'
    });
  });

  it('should parse Gitea URL', () => {
    const result = parseRepository('https://gitea.com/owner/repo', mockLogger);
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      url: 'https://gitea.com/owner/repo',
      platform: 'gitea'
    });
  });

  it('should parse Bitbucket URL', () => {
    const result = parseRepository('https://bitbucket.org/owner/repo', mockLogger);
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      url: 'https://bitbucket.org/owner/repo',
      platform: 'bitbucket'
    });
  });

  it('should parse owner/repo format', () => {
    const result = parseRepository('owner/repo', mockLogger);
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      platform: 'auto'
    });
  });

  it('should return auto platform for unknown URLs', () => {
    const result = parseRepository('https://git.ravenwolf.org/owner/repo', mockLogger);
    expect(result?.platform).toBe('auto');
  });

  it('should return undefined for invalid format', () => {
    const result = parseRepository('invalid', mockLogger);
    expect(result).toBeUndefined();
  });
});

describe('detectPlatform', () => {
  it('should use explicit repo_type if not auto', () => {
    const result = detectPlatform('github', undefined, mockLogger);
    expect(result).toBe('github');
  });

  it('should detect from repository info', () => {
    const repoInfo = {
      owner: 'owner',
      repo: 'repo',
      platform: 'gitea' as const
    };
    const result = detectPlatform('auto', repoInfo, mockLogger);
    expect(result).toBe('gitea');
  });


  it('should fallback to generic', () => {
    const originalGithubRepo = process.env.GITHUB_REPOSITORY;
    const originalGiteaRepo = process.env.GITEA_REPOSITORY;
    const originalGithubServerUrl = process.env.GITHUB_SERVER_URL;
    const originalGiteaServerUrl = process.env.GITEA_SERVER_URL;
    const originalGiteaApiUrl = process.env.GITEA_API_URL;
    
    // Ensure all environment variables are cleared
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITEA_REPOSITORY;
    delete process.env.GITHUB_SERVER_URL;
    delete process.env.GITEA_SERVER_URL;
    delete process.env.GITEA_API_URL;

    const result = detectPlatform('auto', undefined, mockLogger);
    expect(result).toBe('generic');

    if (originalGithubRepo) process.env.GITHUB_REPOSITORY = originalGithubRepo;
    if (originalGiteaRepo) process.env.GITEA_REPOSITORY = originalGiteaRepo;
    if (originalGithubServerUrl) process.env.GITHUB_SERVER_URL = originalGithubServerUrl;
    if (originalGiteaServerUrl) process.env.GITEA_SERVER_URL = originalGiteaServerUrl;
    if (originalGiteaApiUrl) process.env.GITEA_API_URL = originalGiteaApiUrl;
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
    (io.which as jest.Mock).mockResolvedValue('/usr/bin/git');

    const result = await getRepositoryInfo(
      'https://github.com/owner/repo',
      'auto',
      mockLogger
    );

    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('repo');
    expect(result.platform).toBe('github');
  });

  it('should use GITHUB_REPOSITORY if no repository provided', async () => {
    const originalGiteaRepo = process.env.GITEA_REPOSITORY;
    const originalGiteaServerUrl = process.env.GITEA_SERVER_URL;
    const originalGithubServerUrl = process.env.GITHUB_SERVER_URL;
    
    // Ensure Gitea variables are not set
    delete process.env.GITEA_REPOSITORY;
    delete process.env.GITEA_SERVER_URL;
    delete process.env.GITEA_API_URL;
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    delete process.env.GITHUB_SERVER_URL; // Not set or set to github.com
    
    (io.which as jest.Mock).mockResolvedValue('/usr/bin/git');
    (exec.exec as jest.Mock).mockResolvedValue(0);

    const result = await getRepositoryInfo(undefined, 'auto', mockLogger);

    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('repo');
    expect(result.platform).toBe('github');
    
    if (originalGiteaRepo) process.env.GITEA_REPOSITORY = originalGiteaRepo;
    if (originalGiteaServerUrl) process.env.GITEA_SERVER_URL = originalGiteaServerUrl;
    if (originalGithubServerUrl) process.env.GITHUB_SERVER_URL = originalGithubServerUrl;
  });

  it('should throw error if no repository info available', async () => {
    delete process.env.GITHUB_REPOSITORY;
    (io.which as jest.Mock).mockResolvedValue('/usr/bin/git');
    (exec.exec as jest.Mock).mockResolvedValue(1); // Not a git repo

    await expect(
      getRepositoryInfo(undefined, 'auto', mockLogger)
    ).rejects.toThrow('Could not determine repository information');
  });

  it('should use explicit repo_type', async () => {
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    (io.which as jest.Mock).mockResolvedValue('/usr/bin/git');
    (exec.exec as jest.Mock).mockResolvedValue(0);

    const result = await getRepositoryInfo(undefined, 'gitea', mockLogger);

    expect(result.platform).toBe('gitea');
  });
});

