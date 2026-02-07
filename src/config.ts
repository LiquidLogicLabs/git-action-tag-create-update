import * as core from '@actions/core';
import { ActionInputs, RepoType } from './types';

/**
 * Parse boolean input with default value
 */
function getBooleanInput(name: string, defaultValue: boolean = false): boolean {
  const value = core.getInput(name);
  if (value === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

/**
 * Get optional string input
 */
function getOptionalInput(name: string): string | undefined {
  const value = core.getInput(name);
  return value === '' ? undefined : value;
}

/**
 * Parse and validate repo type
 */
function parseRepoType(value: string): RepoType {
  const validTypes: RepoType[] = ['github', 'gitea', 'bitbucket', 'generic', 'git', 'auto'];
  const normalized = value.toLowerCase();
  if (validTypes.includes(normalized as RepoType)) {
    return normalized as RepoType;
  }
  throw new Error(
    `Invalid repoType: ${value}. Must be one of: ${validTypes.join(', ')}`
  );
}

/**
 * Get and validate action inputs
 */
export function getInputs(): ActionInputs {
  const tagName = core.getInput('tagName', { required: true });
  if (!tagName || tagName.trim() === '') {
    throw new Error('tagName is required and cannot be empty');
  }

  // Validate tag name format (basic validation)
  if (!/^[^/]+$/.test(tagName)) {
    throw new Error(
      `Invalid tag name: ${tagName}. Tag names cannot contain forward slashes.`
    );
  }

  const tagMessage = getOptionalInput('tagMessage');
  const tagSha = getOptionalInput('tagSha');
  const repository = getOptionalInput('repository');
  const token = getOptionalInput('token');
  const force = getBooleanInput('force', false);
  const updateExisting = getBooleanInput('updateExisting', false) || force;
  const gpgSign = getBooleanInput('gpgSign', false);
  const gpgKeyId = getOptionalInput('gpgKeyId');
  const repoTypeStr = core.getInput('repoType') || 'auto';
  const repoType = parseRepoType(repoTypeStr);
  const baseUrl = getOptionalInput('baseUrl');
  const ignoreCertErrors = getBooleanInput('skipCertificateCheck', false);
  const verboseInput = getBooleanInput('verbose', false);
  const envStepDebug = (process.env.ACTIONS_STEP_DEBUG || '').toLowerCase();
  const stepDebugEnabled = (typeof core.isDebug === 'function' && core.isDebug()) || envStepDebug === 'true' || envStepDebug === '1';
  const verbose = verboseInput || stepDebugEnabled;
  const pushTag = getBooleanInput('pushTag', true);
  const gitUserName = getOptionalInput('gitUserName');
  const gitUserEmail = getOptionalInput('gitUserEmail');

  // Validate GPG signing requirements
  if (gpgSign && !tagMessage) {
    throw new Error('gpgSign requires tagMessage (GPG signing only works with annotated tags)');
  }

  // Validate GPG key ID if signing is enabled
  if (gpgSign && gpgKeyId && gpgKeyId.trim() === '') {
    throw new Error('gpgKeyId cannot be empty when gpgSign is true');
  }

  // Validate base URL format if provided
  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch {
      throw new Error(`Invalid baseUrl format: ${baseUrl}`);
    }
  }

  const normalizedTagMessage = tagMessage?.trim() || undefined;

  return {
    tagName: tagName.trim(),
    tagMessage: normalizedTagMessage, // Normalize empty strings to undefined
    tagSha: tagSha?.trim(),
    repository: repository?.trim(),
    token: token, // Don't set default here - will be resolved based on platform
    updateExisting,
    gpgSign,
    gpgKeyId: gpgKeyId?.trim(),
    repoType,
    baseUrl,
    ignoreCertErrors,
    force,
    verbose,
    pushTag,
    gitUserName,
    gitUserEmail
  };
}

/**
 * Resolve token from environment variables based on platform
 * Falls back to platform-specific token environment variables if token is not provided
 */
export function resolveToken(token: string | undefined, platform: RepoType): string | undefined {
  // If token is explicitly provided, use it
  if (token) {
    return token;
  }

  // Otherwise, try platform-specific environment variables
  switch (platform) {
    case 'github':
      return process.env.GITHUB_TOKEN;
    case 'gitea':
      return process.env.GITEA_TOKEN || process.env.GITHUB_TOKEN; // Gitea Actions also provides GITHUB_TOKEN
    case 'bitbucket':
      return process.env.BITBUCKET_TOKEN;
    case 'generic':
    case 'git':
    default:
      // For generic/git, try common token environment variables
      return (
        process.env.GITHUB_TOKEN ||
        process.env.GITEA_TOKEN ||
        process.env.BITBUCKET_TOKEN
      );
  }
}

