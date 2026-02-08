import { getInputs, resolveToken } from '../config';
import * as core from '@actions/core';

// Mock @actions/core
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setFailed: jest.fn(),
  setSecret: jest.fn()
}));

describe('getInputs', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should parse required tagName', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.tagName).toBe('v1.0.0');
  });

  it('should throw error if tagName is missing', () => {
    (core.getInput as jest.Mock).mockImplementation(() => '');

    expect(() => getInputs()).toThrow('tagName is required');
  });

  it('should throw error if tagName is empty', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return '   ';
      return '';
    });

    expect(() => getInputs()).toThrow('tagName is required');
  });

  it('should throw error if tagName contains forward slash', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1/0/0';
      return '';
    });

    expect(() => getInputs()).toThrow('Invalid tag name');
  });

  it('should parse optional inputs with defaults', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.updateExisting).toBe(false);
    expect(inputs.gpgSign).toBe(false);
    expect(inputs.ignoreCertErrors).toBe(false);
    expect(inputs.force).toBe(false);
    expect(inputs.verbose).toBe(false);
    expect(inputs.repoType).toBe('auto');
  });

  it('should parse boolean inputs correctly', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      if (name === 'tagMessage') return 'Release v1.0.0'; // Required for gpgSign
      if (name === 'updateExisting') return 'true';
      if (name === 'gpgSign') return 'true';
      if (name === 'skipCertificateCheck') return 'true';
      if (name === 'force') return 'true';
      if (name === 'verbose') return 'true';
      if (name === 'pushTag') return 'true';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.updateExisting).toBe(true);
    expect(inputs.gpgSign).toBe(true);
    expect(inputs.ignoreCertErrors).toBe(true);
    expect(inputs.force).toBe(true);
    expect(inputs.verbose).toBe(true);
    expect(inputs.pushTag).toBe(true);
  });

  it('should accept 1 and 0 for boolean inputs (case-insensitive)', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      if (name === 'verbose') return '1';
      if (name === 'pushTag') return '0';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.verbose).toBe(true);
    expect(inputs.pushTag).toBe(false);
  });

  it('should default pushTag to true', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.pushTag).toBe(true);
  });

  it('should parse pushTag as false when set', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      if (name === 'pushTag') return 'false';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.pushTag).toBe(false);
  });

  it('should parse optional string inputs', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      if (name === 'tagMessage') return 'Release v1.0.0';
      if (name === 'tagSha') return 'abc123';
      if (name === 'repository') return 'owner/repo';
      if (name === 'token') return 'token123';
      if (name === 'gpgKeyId') return 'key123';
      if (name === 'baseUrl') return 'https://example.com';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.tagMessage).toBe('Release v1.0.0');
    expect(inputs.tagSha).toBe('abc123');
    expect(inputs.repository).toBe('owner/repo');
    expect(inputs.token).toBe('token123');
    expect(inputs.gpgKeyId).toBe('key123');
    expect(inputs.baseUrl).toBe('https://example.com');
  });

  it('should not set token from environment in getInputs (token resolution happens later)', () => {
    process.env.GITHUB_TOKEN = 'env-token';
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.token).toBeUndefined();
  });

  it('should parse repoType correctly', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      if (name === 'repoType') return 'github';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.repoType).toBe('github');
  });

  it('should parse git repoType correctly', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      if (name === 'repoType') return 'git';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.repoType).toBe('git');
  });

  it('should throw error for invalid repoType', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      if (name === 'repoType') return 'invalid';
      return '';
    });

    expect(() => getInputs()).toThrow('Invalid repoType');
  });

  it('should throw error if gpgSign is true but tagMessage is missing', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      if (name === 'gpgSign') return 'true';
      return '';
    });

    expect(() => getInputs()).toThrow('gpgSign requires tagMessage');
  });

  it('should throw error for invalid baseUrl format', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      if (name === 'baseUrl') return 'not-a-url';
      return '';
    });

    expect(() => getInputs()).toThrow('Invalid baseUrl format');
  });

  it('should trim whitespace from inputs', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return '  v1.0.0  ';
      if (name === 'tagMessage') return '  Release  ';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.tagName).toBe('v1.0.0');
    expect(inputs.tagMessage).toBe('Release');
  });

  it('should normalize empty tagMessage to undefined', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      if (name === 'tagMessage') return '';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.tagMessage).toBeUndefined();
  });

  it('should normalize whitespace-only tagMessage to undefined', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tagName') return 'v1.0.0';
      if (name === 'tagMessage') return '   \n\t  ';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.tagMessage).toBeUndefined();
  });
});

describe('resolveToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITEA_TOKEN;
    delete process.env.BITBUCKET_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return explicitly provided token', () => {
    expect(resolveToken('explicit-token', 'github')).toBe('explicit-token');
    expect(resolveToken('explicit-token', 'gitea')).toBe('explicit-token');
    expect(resolveToken('explicit-token', 'bitbucket')).toBe('explicit-token');
    expect(resolveToken('explicit-token', 'generic')).toBe('explicit-token');
  });

  it('should use GITHUB_TOKEN for github platform', () => {
    process.env.GITHUB_TOKEN = 'github-token';
    expect(resolveToken(undefined, 'github')).toBe('github-token');
  });

  it('should use GITEA_TOKEN for gitea platform', () => {
    process.env.GITEA_TOKEN = 'gitea-token';
    expect(resolveToken(undefined, 'gitea')).toBe('gitea-token');
  });

  it('should fallback to GITHUB_TOKEN for gitea if GITEA_TOKEN not set', () => {
    process.env.GITHUB_TOKEN = 'github-token';
    expect(resolveToken(undefined, 'gitea')).toBe('github-token');
  });

  it('should prefer GITEA_TOKEN over GITHUB_TOKEN for gitea platform', () => {
    process.env.GITEA_TOKEN = 'gitea-token';
    process.env.GITHUB_TOKEN = 'github-token';
    expect(resolveToken(undefined, 'gitea')).toBe('gitea-token');
  });

  it('should use BITBUCKET_TOKEN for bitbucket platform', () => {
    process.env.BITBUCKET_TOKEN = 'bitbucket-token';
    expect(resolveToken(undefined, 'bitbucket')).toBe('bitbucket-token');
  });

  it('should try common tokens for generic platform', () => {
    process.env.GITHUB_TOKEN = 'github-token';
    expect(resolveToken(undefined, 'generic')).toBe('github-token');
  });

  it('should check tokens in order for generic platform (GITHUB_TOKEN first)', () => {
    process.env.GITHUB_TOKEN = 'github-token';
    process.env.GITEA_TOKEN = 'gitea-token';
    process.env.BITBUCKET_TOKEN = 'bitbucket-token';
    // For generic, checks in order: GITHUB_TOKEN, GITEA_TOKEN, BITBUCKET_TOKEN
    expect(resolveToken(undefined, 'generic')).toBe('github-token');
  });

  it('should fallback to GITEA_TOKEN for generic if GITHUB_TOKEN not set', () => {
    process.env.GITEA_TOKEN = 'gitea-token';
    process.env.BITBUCKET_TOKEN = 'bitbucket-token';
    expect(resolveToken(undefined, 'generic')).toBe('gitea-token');
  });

  it('should fallback to BITBUCKET_TOKEN for generic if others not set', () => {
    process.env.BITBUCKET_TOKEN = 'bitbucket-token';
    expect(resolveToken(undefined, 'generic')).toBe('bitbucket-token');
  });

  it('should try common tokens for git platform (same as generic)', () => {
    process.env.GITHUB_TOKEN = 'github-token';
    expect(resolveToken(undefined, 'git')).toBe('github-token');
  });

  it('should return undefined if no token env vars are set', () => {
    expect(resolveToken(undefined, 'github')).toBeUndefined();
    expect(resolveToken(undefined, 'gitea')).toBeUndefined();
    expect(resolveToken(undefined, 'bitbucket')).toBeUndefined();
    expect(resolveToken(undefined, 'generic')).toBeUndefined();
  });
});

