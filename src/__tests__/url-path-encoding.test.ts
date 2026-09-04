import { safeSegment } from '../repo-utils';
import { GitHubAPI } from '../platforms/github';
import { GiteaAPI } from '../platforms/gitea';
import { BitbucketAPI } from '../platforms/bitbucket';
import { HttpClient } from '../platforms/http-client';
import { Logger } from '../logger';

jest.mock('../platforms/http-client');

/**
 * A value interpolated unencoded into an API path can redirect the request to a different
 * endpoint. Verified against WHATWG URL resolution, which is what fetch applies:
 *
 *   tag = "../../../user"  ->  /repos/o/r/git/refs/tags/../../../user  =>  /repos/o/user
 *   tag = ".."             ->  /repos/o/r/git/refs/tags/..             =>  /repos/o/r/git/refs/
 *
 * The second is the dangerous one here: this action issues DELETE against these paths
 * (GitHubAPI.deleteTag, GiteaAPI.deleteTag, BitbucketAPI.deleteTag), so a redirected
 * request acts on the refs COLLECTION rather than on one tag.
 *
 * encodeURIComponent alone is NOT sufficient — it does not encode dots, so ".." survives it
 * unchanged and is then removed by dot-segment normalisation. Tests assert the NORMALIZED
 * pathname, because asserting the built string passes while the sink stays open.
 *
 * Every interpolated value is attacker-influenceable: tag names and owner/repo come from
 * action inputs (`tag-name`, `repository`), and the default branch used by getHeadSha comes
 * from a server response body.
 */
const BASE = 'https://api.example.com';
const normalized = (path: string) => new URL(BASE + path).pathname;

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn()
} as unknown as Logger;

describe('safeSegment', () => {
  it('encodes slashes so a segment cannot introduce new path levels', () => {
    const path = `/repos/o/r/git/refs/tags/${safeSegment('../../../user', 'tag')}`;
    expect(normalized(path)).toBe('/repos/o/r/git/refs/tags/..%2F..%2F..%2Fuser');
  });

  it.each(['..', '.'])('refuses a bare %s, which encoding alone would not stop', (dots) => {
    expect(() => safeSegment(dots, 'tag')).toThrow(/redirect/i);
  });

  it('encodes a query string so it cannot alter the request', () => {
    const path = `/repos/o/r/tags/${safeSegment('v1?per_page=1', 'tag')}`;
    expect(normalized(path)).toBe('/repos/o/r/tags/v1%3Fper_page%3D1');
    expect(new URL(BASE + path).search).toBe('');
  });

  it('encodes a fragment so the rest of the path is not discarded', () => {
    const path = `/repos/o/r/tags/${safeSegment('v1#x', 'tag')}`;
    expect(normalized(path)).toBe('/repos/o/r/tags/v1%23x');
  });

  it('leaves an ordinary tag readable', () => {
    expect(safeSegment('v1.2.3', 'tag')).toBe('v1.2.3');
    expect(normalized(`/repos/o/r/tags/${safeSegment('v1.2.3', 'tag')}`)).toBe('/repos/o/r/tags/v1.2.3');
  });

  it('names the label so an operator can tell which value was rejected', () => {
    expect(() => safeSegment('..', 'owner')).toThrow(/owner/);
  });
});

/**
 * The helper being correct proves nothing about the call sites. These exercise the sinks:
 * the path handed to HttpClient is resolved the way fetch would resolve it, and must still
 * name the intended endpoint.
 */
describe('platform clients do not let a value escape its path segment', () => {
  let http: jest.Mocked<HttpClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    http = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      request: jest.fn()
    } as unknown as jest.Mocked<HttpClient>;
    (HttpClient as unknown as jest.Mock).mockImplementation(() => http);
  });

  const config = { token: 't', ignoreCertErrors: false, verbose: false, baseUrl: BASE };
  const repoInfo = { owner: 'owner', repo: 'repo', platform: 'auto' as const };

  describe('GitHubAPI', () => {
    const api = () => new GitHubAPI(repoInfo, { ...config, type: 'github' }, mockLogger);

    it('DELETE stays on one tag when the tag name is a traversal', async () => {
      http.delete.mockResolvedValue(undefined as never);
      await api().deleteTag('../../../../user');
      const path = http.delete.mock.calls[0][0] as string;
      expect(normalized(path)).toBe('/repos/owner/repo/git/refs/tags/..%2F..%2F..%2F..%2Fuser');
    });

    it('refuses a bare .. rather than issuing DELETE against the refs collection', async () => {
      await expect(api().deleteTag('..')).rejects.toThrow(/redirect/i);
      expect(http.delete).not.toHaveBeenCalled();
    });

    it('GET tagExists stays on one tag', async () => {
      http.get.mockResolvedValue([] as never);
      await api().tagExists('../../../user');
      expect(normalized(http.get.mock.calls[0][0] as string)).toBe('/repos/owner/repo/git/refs/tags/..%2F..%2F..%2Fuser');
    });

    it('a hostile owner from the repository input cannot escape its segment', async () => {
      http.delete.mockResolvedValue(undefined as never);
      const hostile = new GitHubAPI({ owner: '../..', repo: 'repo', platform: 'auto' }, { ...config, type: 'github' }, mockLogger);
      await hostile.deleteTag('v1');
      expect(normalized(http.delete.mock.calls[0][0] as string)).toBe('/repos/..%2F../repo/git/refs/tags/v1');
    });

    it('refuses a default branch of .. supplied by the server', async () => {
      http.get.mockResolvedValue({ default_branch: '..' } as never);
      await expect(api().getHeadSha()).rejects.toThrow(/redirect/i);
    });
  });

  describe('GiteaAPI', () => {
    const api = () => new GiteaAPI(repoInfo, { ...config, type: 'gitea', baseUrl: `${BASE}/api/v1` }, mockLogger);

    it('DELETE stays on one tag when the tag name is a traversal', async () => {
      http.delete.mockResolvedValue(undefined as never);
      await api().deleteTag('../../../../user');
      expect(normalized(http.delete.mock.calls[0][0] as string)).toBe('/repos/owner/repo/tags/..%2F..%2F..%2F..%2Fuser');
    });

    it('refuses a bare .. rather than issuing DELETE against the tags collection', async () => {
      await expect(api().deleteTag('..')).rejects.toThrow(/redirect/i);
      expect(http.delete).not.toHaveBeenCalled();
    });

    it('GET tagExists stays on one tag', async () => {
      http.get.mockResolvedValue([] as never);
      await api().tagExists('../../../user');
      expect(normalized(http.get.mock.calls[0][0] as string)).toBe('/repos/owner/repo/git/refs/tags/..%2F..%2F..%2Fuser');
    });

    it('a hostile repo from the repository input cannot escape its segment', async () => {
      http.delete.mockResolvedValue(undefined as never);
      const hostile = new GiteaAPI({ owner: 'owner', repo: '../..', platform: 'auto' }, { ...config, type: 'gitea', baseUrl: `${BASE}/api/v1` }, mockLogger);
      await hostile.deleteTag('v1');
      expect(normalized(http.delete.mock.calls[0][0] as string)).toBe('/repos/owner/..%2F../tags/v1');
    });

    it('refuses a default branch of .. supplied by the server', async () => {
      http.get.mockResolvedValue({ default_branch: '..' } as never);
      await expect(api().getHeadSha()).rejects.toThrow(/redirect/i);
    });
  });

  describe('BitbucketAPI', () => {
    const api = () => new BitbucketAPI(repoInfo, { ...config, type: 'bitbucket' }, mockLogger);

    it('DELETE stays on one tag when the tag name is a traversal', async () => {
      http.delete.mockResolvedValue(undefined as never);
      await api().deleteTag('../../../../user');
      expect(normalized(http.delete.mock.calls[0][0] as string)).toBe('/repositories/owner/repo/refs/tags/..%2F..%2F..%2F..%2Fuser');
    });

    it('refuses a bare .. rather than issuing DELETE against the refs collection', async () => {
      await expect(api().deleteTag('..')).rejects.toThrow(/redirect/i);
      expect(http.delete).not.toHaveBeenCalled();
    });

    it('refuses a default branch of .. supplied by the server', async () => {
      http.get.mockResolvedValue({ mainbranch: { name: '..' } } as never);
      await expect(api().getHeadSha()).rejects.toThrow(/redirect/i);
    });
  });
});
