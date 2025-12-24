import { getInputs } from '../config';
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

  it('should parse required tag_name', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tag_name') return 'v1.0.0';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.tagName).toBe('v1.0.0');
  });

  it('should throw error if tag_name is missing', () => {
    (core.getInput as jest.Mock).mockImplementation(() => '');

    expect(() => getInputs()).toThrow('tag_name is required');
  });

  it('should throw error if tag_name is empty', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tag_name') return '   ';
      return '';
    });

    expect(() => getInputs()).toThrow('tag_name is required');
  });

  it('should throw error if tag_name contains forward slash', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tag_name') return 'v1/0/0';
      return '';
    });

    expect(() => getInputs()).toThrow('Invalid tag name');
  });

  it('should parse optional inputs with defaults', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tag_name') return 'v1.0.0';
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
      if (name === 'tag_name') return 'v1.0.0';
      if (name === 'tag_message') return 'Release v1.0.0'; // Required for gpg_sign
      if (name === 'update_existing') return 'true';
      if (name === 'gpg_sign') return 'true';
      if (name === 'ignore_cert_errors') return 'true';
      if (name === 'force') return 'true';
      if (name === 'verbose') return 'true';
      if (name === 'push_tag') return 'true';
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

  it('should default push_tag to true', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tag_name') return 'v1.0.0';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.pushTag).toBe(true);
  });

  it('should parse push_tag as false when set', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tag_name') return 'v1.0.0';
      if (name === 'push_tag') return 'false';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.pushTag).toBe(false);
  });

  it('should parse optional string inputs', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tag_name') return 'v1.0.0';
      if (name === 'tag_message') return 'Release v1.0.0';
      if (name === 'tag_sha') return 'abc123';
      if (name === 'repository') return 'owner/repo';
      if (name === 'token') return 'token123';
      if (name === 'gpg_key_id') return 'key123';
      if (name === 'base_url') return 'https://example.com';
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

  it('should use GITHUB_TOKEN from environment if token not provided', () => {
    process.env.GITHUB_TOKEN = 'env-token';
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tag_name') return 'v1.0.0';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.token).toBe('env-token');
  });

  it('should parse repo_type correctly', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tag_name') return 'v1.0.0';
      if (name === 'repo_type') return 'github';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.repoType).toBe('github');
  });

  it('should throw error for invalid repo_type', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tag_name') return 'v1.0.0';
      if (name === 'repo_type') return 'invalid';
      return '';
    });

    expect(() => getInputs()).toThrow('Invalid repo_type');
  });

  it('should throw error if gpg_sign is true but tag_message is missing', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tag_name') return 'v1.0.0';
      if (name === 'gpg_sign') return 'true';
      return '';
    });

    expect(() => getInputs()).toThrow('gpg_sign requires tag_message');
  });

  it('should throw error for invalid base_url format', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tag_name') return 'v1.0.0';
      if (name === 'base_url') return 'not-a-url';
      return '';
    });

    expect(() => getInputs()).toThrow('Invalid base_url format');
  });

  it('should trim whitespace from inputs', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'tag_name') return '  v1.0.0  ';
      if (name === 'tag_message') return '  Release  ';
      return '';
    });

    const inputs = getInputs();
    expect(inputs.tagName).toBe('v1.0.0');
    expect(inputs.tagMessage).toBe('Release');
  });
});

