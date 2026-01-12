import { detectFromUrlByHostname as detectGithubFromUrlByHostname, detectFromUrl as detectGithubFromUrl, determineBaseUrl as determineGithubBaseUrl } from '../../platforms/github';
import { detectFromUrlByHostname as detectGiteaFromUrlByHostname, detectFromUrl as detectGiteaFromUrl, determineBaseUrl as determineGiteaBaseUrl } from '../../platforms/gitea';
import { detectFromUrlByHostname as detectBitbucketFromUrlByHostname, detectFromUrl as detectBitbucketFromUrl, determineBaseUrl as determineBitbucketBaseUrl } from '../../platforms/bitbucket';
import { detectFromUrlByHostname as detectGenericFromUrlByHostname, detectFromUrl as detectGenericFromUrl, determineBaseUrl as determineGenericBaseUrl } from '../../platforms/generic';
import { Logger } from '../../logger';

// Mock fetch for detectFromUrl tests
const originalFetch = global.fetch;

describe('Platform Detection Functions', () => {
  const logger = new Logger(false);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('detectFromUrlByHostname', () => {
    describe('GitHub', () => {
      it('should detect github.com', () => {
        const url = new URL('https://github.com/owner/repo');
        const result = detectGithubFromUrlByHostname(url);
        expect(result).toBe('github');
      });

      it('should detect github.com with subdomain', () => {
        const url = new URL('https://gist.github.com/owner/repo');
        const result = detectGithubFromUrlByHostname(url);
        expect(result).toBe('github');
      });

      it('should not detect non-github URLs', () => {
        const url = new URL('https://gitlab.com/owner/repo');
        const result = detectGithubFromUrlByHostname(url);
        expect(result).toBeUndefined();
      });

      it('should handle case-insensitive hostname', () => {
        const url = new URL('https://GITHUB.COM/owner/repo');
        const result = detectGithubFromUrlByHostname(url);
        expect(result).toBe('github');
      });
    });

    describe('Gitea', () => {
      it('should detect gitea.com', () => {
        const url = new URL('https://gitea.com/owner/repo');
        const result = detectGiteaFromUrlByHostname(url);
        expect(result).toBe('gitea');
      });

      it('should detect hostname containing "gitea"', () => {
        const url = new URL('https://gitea.example.com/owner/repo');
        const result = detectGiteaFromUrlByHostname(url);
        expect(result).toBe('gitea');
      });

      it('should detect self-hosted gitea', () => {
        const url = new URL('https://git.ravenwolf.org/owner/repo');
        // This should NOT detect as gitea from hostname (no "gitea" in hostname)
        const result = detectGiteaFromUrlByHostname(url);
        expect(result).toBeUndefined();
      });

      it('should not detect non-gitea URLs', () => {
        const url = new URL('https://github.com/owner/repo');
        const result = detectGiteaFromUrlByHostname(url);
        expect(result).toBeUndefined();
      });

      it('should handle case-insensitive hostname', () => {
        const url = new URL('https://GITEA.COM/owner/repo');
        const result = detectGiteaFromUrlByHostname(url);
        expect(result).toBe('gitea');
      });
    });

    describe('Bitbucket', () => {
      it('should detect bitbucket.org', () => {
        const url = new URL('https://bitbucket.org/owner/repo');
        const result = detectBitbucketFromUrlByHostname(url);
        expect(result).toBe('bitbucket');
      });

      it('should detect hostname containing "bitbucket"', () => {
        const url = new URL('https://bitbucket.example.com/owner/repo');
        const result = detectBitbucketFromUrlByHostname(url);
        expect(result).toBe('bitbucket');
      });

      it('should not detect non-bitbucket URLs', () => {
        const url = new URL('https://github.com/owner/repo');
        const result = detectBitbucketFromUrlByHostname(url);
        expect(result).toBeUndefined();
      });

      it('should handle case-insensitive hostname', () => {
        const url = new URL('https://BITBUCKET.ORG/owner/repo');
        const result = detectBitbucketFromUrlByHostname(url);
        expect(result).toBe('bitbucket');
      });
    });

    describe('Generic', () => {
      it('should always return undefined', () => {
        const url = new URL('https://example.com/owner/repo');
        const result = detectGenericFromUrlByHostname(url);
        expect(result).toBeUndefined();
      });

      it('should return undefined for any URL', () => {
        const url = new URL('https://github.com/owner/repo');
        const result = detectGenericFromUrlByHostname(url);
        expect(result).toBeUndefined();
      });
    });
  });

  describe('detectFromUrl', () => {
    describe('GitHub', () => {
      it('should detect GitHub API endpoint', async () => {
        global.fetch = jest.fn().mockResolvedValue(
          new Response(null, { status: 200, statusText: 'OK' })
        );

        const url = new URL('https://github.com/owner/repo');
        const result = await detectGithubFromUrl(url, logger);
        expect(result).toBe('github');
        expect(global.fetch).toHaveBeenCalled();
      });

      it('should detect GitHub API with /api/v3 path', async () => {
        global.fetch = jest.fn().mockImplementation((input: any) => {
          const urlStr = input.toString();
          if (urlStr.includes('/api/v3')) {
            return Promise.resolve(new Response(null, { status: 200, statusText: 'OK' }));
          }
          return Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' }));
        });

        const url = new URL('https://github.example.com/owner/repo');
        const result = await detectGithubFromUrl(url, logger);
        expect(result).toBe('github');
      });

      it('should detect GitHub API with /api path', async () => {
        global.fetch = jest.fn().mockImplementation((input: any) => {
          const urlStr = input.toString();
          if (urlStr.includes('/api') && !urlStr.includes('/api/v3')) {
            return Promise.resolve(new Response(null, { status: 200, statusText: 'OK' }));
          }
          return Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' }));
        });

        const url = new URL('https://github.example.com/owner/repo');
        const result = await detectGithubFromUrl(url, logger);
        expect(result).toBe('github');
      });

      it('should return undefined when API endpoints are not available', async () => {
        global.fetch = jest.fn().mockResolvedValue(
          new Response(null, { status: 404, statusText: 'Not Found' })
        );

        const url = new URL('https://example.com/owner/repo');
        const result = await detectGithubFromUrl(url, logger);
        expect(result).toBeUndefined();
      });

      it('should handle timeout errors', async () => {
        global.fetch = jest.fn().mockImplementation(() => {
          const controller = new AbortController();
          controller.abort();
          return Promise.reject(new Error('AbortError'));
        });

        const url = new URL('https://github.com/owner/repo');
        const result = await detectGithubFromUrl(url, logger);
        expect(result).toBeUndefined();
      });
    });

    describe('Gitea', () => {
      it('should detect Gitea API endpoint', async () => {
        global.fetch = jest.fn().mockResolvedValue(
          new Response(null, { status: 200, statusText: 'OK' })
        );

        const url = new URL('https://gitea.com/owner/repo');
        const result = await detectGiteaFromUrl(url, logger);
        expect(result).toBe('gitea');
        expect(global.fetch).toHaveBeenCalled();
      });

      it('should detect Gitea API with /api/v1/version path', async () => {
        global.fetch = jest.fn().mockImplementation((input: any) => {
          const urlStr = input.toString();
          if (urlStr.includes('/api/v1/version')) {
            return Promise.resolve(new Response(null, { status: 200, statusText: 'OK' }));
          }
          return Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' }));
        });

        const url = new URL('https://git.example.com/owner/repo');
        const result = await detectGiteaFromUrl(url, logger);
        expect(result).toBe('gitea');
      });

      it('should return undefined when API endpoint is not available', async () => {
        global.fetch = jest.fn().mockResolvedValue(
          new Response(null, { status: 404, statusText: 'Not Found' })
        );

        const url = new URL('https://example.com/owner/repo');
        const result = await detectGiteaFromUrl(url, logger);
        expect(result).toBeUndefined();
      });

      it('should handle timeout errors', async () => {
        global.fetch = jest.fn().mockImplementation(() => {
          const controller = new AbortController();
          controller.abort();
          return Promise.reject(new Error('AbortError'));
        });

        const url = new URL('https://gitea.com/owner/repo');
        const result = await detectGiteaFromUrl(url, logger);
        expect(result).toBeUndefined();
      });
    });

    describe('Bitbucket', () => {
      it('should detect Bitbucket API endpoint', async () => {
        global.fetch = jest.fn().mockResolvedValue(
          new Response(null, { status: 200, statusText: 'OK' })
        );

        const url = new URL('https://bitbucket.org/owner/repo');
        const result = await detectBitbucketFromUrl(url, logger);
        expect(result).toBe('bitbucket');
        expect(global.fetch).toHaveBeenCalled();
      });

      it('should detect Bitbucket API with /rest/api/1.0 path', async () => {
        global.fetch = jest.fn().mockImplementation((input: any) => {
          const urlStr = input.toString();
          if (urlStr.includes('/rest/api/1.0')) {
            return Promise.resolve(new Response(null, { status: 200, statusText: 'OK' }));
          }
          return Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' }));
        });

        const url = new URL('https://bitbucket.example.com/owner/repo');
        const result = await detectBitbucketFromUrl(url, logger);
        expect(result).toBe('bitbucket');
      });

      it('should detect Bitbucket API with /2.0 path', async () => {
        global.fetch = jest.fn().mockImplementation((input: any) => {
          const urlStr = input.toString();
          if (urlStr.includes('/2.0')) {
            return Promise.resolve(new Response(null, { status: 200, statusText: 'OK' }));
          }
          return Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' }));
        });

        const url = new URL('https://bitbucket.example.com/owner/repo');
        const result = await detectBitbucketFromUrl(url, logger);
        expect(result).toBe('bitbucket');
      });

      it('should return undefined when API endpoints are not available', async () => {
        global.fetch = jest.fn().mockResolvedValue(
          new Response(null, { status: 404, statusText: 'Not Found' })
        );

        const url = new URL('https://example.com/owner/repo');
        const result = await detectBitbucketFromUrl(url, logger);
        expect(result).toBeUndefined();
      });

      it('should handle timeout errors', async () => {
        global.fetch = jest.fn().mockImplementation(() => {
          const controller = new AbortController();
          controller.abort();
          return Promise.reject(new Error('AbortError'));
        });

        const url = new URL('https://bitbucket.org/owner/repo');
        const result = await detectBitbucketFromUrl(url, logger);
        expect(result).toBeUndefined();
      });
    });

    describe('Generic', () => {
      it('should always return undefined', async () => {
        const url = new URL('https://example.com/owner/repo');
        const result = await detectGenericFromUrl(url, logger);
        expect(result).toBeUndefined();
      });
    });
  });

  describe('determineBaseUrl', () => {
    describe('GitHub', () => {
      it('should return default GitHub API URL when no URLs provided', () => {
        const result = determineGithubBaseUrl([]);
        expect(result).toBe('https://api.github.com');
      });

      it('should return default GitHub API URL for empty array', () => {
        const result = determineGithubBaseUrl('');
        expect(result).toBe('https://api.github.com');
      });

      it('should use explicit API URL if provided', () => {
        const result = determineGithubBaseUrl('https://api.github.com');
        expect(result).toBe('https://api.github.com');
      });

      it('should use API URL from repository URL array', () => {
        const urls = ['https://github.com/owner/repo', 'https://api.github.com'];
        const result = determineGithubBaseUrl(urls);
        expect(result).toBe('https://api.github.com');
      });

      it('should detect API URL from URL with /api path', () => {
        const urls = ['https://github.example.com/api'];
        const result = determineGithubBaseUrl(urls);
        expect(result).toBe('https://github.example.com/api');
      });

      it('should return default when repository URL does not contain /api', () => {
        const urls = ['https://github.com/owner/repo'];
        const result = determineGithubBaseUrl(urls);
        expect(result).toBe('https://api.github.com');
      });
    });

    describe('Gitea', () => {
      it('should return default Gitea API URL when no URLs provided', () => {
        const result = determineGiteaBaseUrl([]);
        expect(result).toBe('https://gitea.com/api/v1');
      });

      it('should append /api/v1 to repository URL', () => {
        const result = determineGiteaBaseUrl('https://gitea.com/owner/repo');
        expect(result).toBe('https://gitea.com/api/v1');
      });

      it('should append /api/v1 to self-hosted Gitea URL', () => {
        const result = determineGiteaBaseUrl('https://git.example.com/owner/repo');
        expect(result).toBe('https://git.example.com/api/v1');
      });

      it('should use existing /api/v1 path', () => {
        const result = determineGiteaBaseUrl('https://gitea.com/api/v1');
        expect(result).toBe('https://gitea.com/api/v1');
      });

      it('should use existing /api/v2 path', () => {
        const result = determineGiteaBaseUrl('https://gitea.com/api/v2');
        expect(result).toBe('https://gitea.com/api/v2');
      });

      it('should handle URL array', () => {
        const urls = ['https://gitea.com/owner/repo', 'https://git.example.com/owner/repo'];
        const result = determineGiteaBaseUrl(urls);
        expect(result).toBe('https://gitea.com/api/v1');
      });

      it('should handle invalid URLs gracefully', () => {
        const urls = ['not-a-url', 'https://gitea.com/owner/repo'];
        const result = determineGiteaBaseUrl(urls);
        expect(result).toBe('https://gitea.com/api/v1');
      });
    });

    describe('Bitbucket', () => {
      it('should always return Bitbucket API URL', () => {
        const result = determineBitbucketBaseUrl([]);
        expect(result).toBe('https://api.bitbucket.org/2.0');
      });

      it('should return Bitbucket API URL regardless of input', () => {
        const result = determineBitbucketBaseUrl('https://bitbucket.org/owner/repo');
        expect(result).toBe('https://api.bitbucket.org/2.0');
      });

      it('should return Bitbucket API URL for URL array', () => {
        const urls = ['https://bitbucket.org/owner/repo', 'https://example.com'];
        const result = determineBitbucketBaseUrl(urls);
        expect(result).toBe('https://api.bitbucket.org/2.0');
      });
    });

    describe('Generic', () => {
      it('should always return undefined', () => {
        const result = determineGenericBaseUrl([]);
        expect(result).toBeUndefined();
      });

      it('should return undefined for any input', () => {
        const result = determineGenericBaseUrl('https://example.com/owner/repo');
        expect(result).toBeUndefined();
      });

      it('should return undefined for URL array', () => {
        const urls = ['https://example.com/owner/repo'];
        const result = determineGenericBaseUrl(urls);
        expect(result).toBeUndefined();
      });
    });
  });
});
