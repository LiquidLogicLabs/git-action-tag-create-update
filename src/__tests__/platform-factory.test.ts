import { createPlatformAPI } from '../platforms/platform-factory';
import { Logger } from '../logger';
import { GitHubAPI } from '../platforms/github';
import { GiteaAPI } from '../platforms/gitea';
import { GenericGitAPI } from '../platforms/generic';
import { BitbucketAPI } from '../platforms/bitbucket';
import * as exec from '@actions/exec';

jest.mock('@actions/exec');

describe('platform-factory', () => {
  const logger = new Logger(false);
  const baseConfig = {
    token: 'token',
    baseUrl: undefined as string | undefined,
    ignoreCertErrors: false,
    verbose: false,
    pushTag: false
  };

  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock git exec to return no origin URL (simulate no git remote)
    (exec.exec as jest.Mock).mockRejectedValue(new Error('No remote origin'));
    // Clear environment variables that might affect platform detection
    process.env = { ...originalEnv };
    delete process.env.GITHUB_SERVER_URL;
    delete process.env.GITEA_SERVER_URL;
    delete process.env.GITEA_API_URL;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('selects platform by hostname first (github.com)', async () => {
    const repoInfo = {
      owner: 'owner',
      repo: 'repo',
      platform: 'auto' as const,
      url: 'https://github.com/owner/repo.git'
    };

    const { platform, api } = await createPlatformAPI(repoInfo, 'auto', baseConfig, logger);
    expect(platform).toBe('github');
    expect(api).toBeInstanceOf(GitHubAPI);
  });

  it('falls back to per-platform detect when hostname is unknown (detects gitea)', async () => {
    const repoInfo = {
      owner: 'owner',
      repo: 'repo',
      platform: 'auto' as const,
      url: 'https://git.ravenwolf.org/owner/repo'
    };

    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input: any) => {
      const url = input.toString();
      if (url.includes('/api/v1/version')) {
        return Promise.resolve(new Response(null, { status: 200, statusText: 'OK' }));
      }
      return Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' }));
    });

    const { platform, api } = await createPlatformAPI(repoInfo, 'auto', baseConfig, logger);
    expect(platform).toBe('gitea');
    expect(api).toBeInstanceOf(GiteaAPI);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns generic when no detectors match', async () => {
    const repoInfo = {
      owner: 'owner',
      repo: 'repo',
      platform: 'auto' as const,
      url: 'https://unknown.example/owner/repo'
    };

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, { status: 404, statusText: 'Not Found' })
    );

    const { platform, api } = await createPlatformAPI(repoInfo, 'auto', baseConfig, logger);
    expect(platform).toBe('generic');
    expect(api).toBeInstanceOf(GenericGitAPI);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('respects explicit repoType override', async () => {
    const repoInfo = {
      owner: 'owner',
      repo: 'repo',
      platform: 'auto' as const,
      url: 'https://example.com/owner/repo'
    };

    const { platform, api } = await createPlatformAPI(repoInfo, 'bitbucket', baseConfig, logger);
    expect(platform).toBe('bitbucket');
    expect(api).toBeInstanceOf(BitbucketAPI);
  });

  it('selects platform by hostname first (bitbucket.org)', async () => {
    const repoInfo = {
      owner: 'owner',
      repo: 'repo',
      platform: 'auto' as const,
      url: 'https://bitbucket.org/owner/repo.git'
    };

    const { platform, api } = await createPlatformAPI(repoInfo, 'auto', baseConfig, logger);
    expect(platform).toBe('bitbucket');
    expect(api).toBeInstanceOf(BitbucketAPI);
  });

  it('selects platform by hostname first (gitea.com)', async () => {
    const repoInfo = {
      owner: 'owner',
      repo: 'repo',
      platform: 'auto' as const,
      url: 'https://gitea.com/owner/repo.git'
    };

    const { platform, api } = await createPlatformAPI(repoInfo, 'auto', baseConfig, logger);
    expect(platform).toBe('gitea');
    expect(api).toBeInstanceOf(GiteaAPI);
  });

  it('falls back to per-platform detect when hostname is unknown (detects bitbucket)', async () => {
    const repoInfo = {
      owner: 'owner',
      repo: 'repo',
      platform: 'auto' as const,
      url: 'https://git.example.com/owner/repo' // Doesn't contain "bitbucket" in hostname
    };

    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input: any) => {
      const url = input.toString();
      // Only respond to Bitbucket API endpoints
      if (url.includes('/rest/api/1.0') || url.includes('/2.0')) {
        return Promise.resolve(new Response(null, { status: 200, statusText: 'OK' }));
      }
      // Return 404 for all other endpoints (Gitea, GitHub, etc.)
      return Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' }));
    });

    const { platform, api } = await createPlatformAPI(repoInfo, 'auto', baseConfig, logger);
    expect(platform).toBe('bitbucket');
    expect(api).toBeInstanceOf(BitbucketAPI);
    expect(fetchMock).toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('falls back to per-platform detect when hostname is unknown (detects github)', async () => {
    const repoInfo = {
      owner: 'owner',
      repo: 'repo',
      platform: 'auto' as const,
      url: 'https://github.example.com/owner/repo'
    };

    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input: any) => {
      const url = input.toString();
      // Only respond to GitHub API endpoints (not Gitea)
      if (url.includes('/api/v3') || (url.includes('/api') && !url.includes('/api/v1'))) {
        return Promise.resolve(new Response(null, { status: 200, statusText: 'OK' }));
      }
      // Return 404 for all other endpoints (Gitea, Bitbucket, etc.)
      return Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' }));
    });

    const { platform, api } = await createPlatformAPI(repoInfo, 'auto', baseConfig, logger);
    expect(platform).toBe('github');
    expect(api).toBeInstanceOf(GitHubAPI);
    expect(fetchMock).toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('handles invalid URL gracefully', async () => {
    const repoInfo = {
      owner: 'owner',
      repo: 'repo',
      platform: 'auto' as const,
      url: 'not-a-valid-url'
    };

    // Should not throw, but fall back to generic
    const { platform, api } = await createPlatformAPI(repoInfo, 'auto', baseConfig, logger);
    expect(platform).toBe('generic');
    expect(api).toBeInstanceOf(GenericGitAPI);
  });

  it('handles empty URL array gracefully', async () => {
    const repoInfo = {
      owner: 'owner',
      repo: 'repo',
      platform: 'auto' as const,
      url: undefined
    };

    // Should fall back to generic
    const { platform, api } = await createPlatformAPI(repoInfo, 'auto', baseConfig, logger);
    expect(platform).toBe('generic');
    expect(api).toBeInstanceOf(GenericGitAPI);
  });

  it('handles detection timeout gracefully', async () => {
    const repoInfo = {
      owner: 'owner',
      repo: 'repo',
      platform: 'auto' as const,
      url: 'https://unknown.example.com/owner/repo'
    };

    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(() => {
      const controller = new AbortController();
      controller.abort();
      return Promise.reject(new Error('AbortError'));
    });

    const { platform, api } = await createPlatformAPI(repoInfo, 'auto', baseConfig, logger);
    expect(platform).toBe('generic');
    expect(api).toBeInstanceOf(GenericGitAPI);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('uses explicit baseUrl when provided', async () => {
    const repoInfo = {
      owner: 'owner',
      repo: 'repo',
      platform: 'auto' as const,
      url: 'https://github.com/owner/repo'
    };

    const configWithBaseUrl = {
      ...baseConfig,
      baseUrl: 'https://api.github.example.com'
    };

    const { platform, api } = await createPlatformAPI(repoInfo, 'auto', configWithBaseUrl, logger);
    expect(platform).toBe('github');
    expect(api).toBeInstanceOf(GitHubAPI);
  });
});
