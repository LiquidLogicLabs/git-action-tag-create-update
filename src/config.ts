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
  const validTypes: RepoType[] = ['github', 'gitea', 'bitbucket', 'generic', 'auto'];
  const normalized = value.toLowerCase();
  if (validTypes.includes(normalized as RepoType)) {
    return normalized as RepoType;
  }
  throw new Error(
    `Invalid repo_type: ${value}. Must be one of: ${validTypes.join(', ')}`
  );
}

/**
 * Get and validate action inputs
 */
export function getInputs(): ActionInputs {
  const tagName = core.getInput('tag_name', { required: true });
  if (!tagName || tagName.trim() === '') {
    throw new Error('tag_name is required and cannot be empty');
  }

  // Validate tag name format (basic validation)
  if (!/^[^/]+$/.test(tagName)) {
    throw new Error(
      `Invalid tag name: ${tagName}. Tag names cannot contain forward slashes.`
    );
  }

  const tagMessage = getOptionalInput('tag_message');
  const tagSha = getOptionalInput('tag_sha');
  const repository = getOptionalInput('repository');
  const token = getOptionalInput('token');
  const updateExisting = getBooleanInput('update_existing', false);
  const gpgSign = getBooleanInput('gpg_sign', false);
  const gpgKeyId = getOptionalInput('gpg_key_id');
  const repoTypeStr = core.getInput('repo_type') || 'auto';
  const repoType = parseRepoType(repoTypeStr);
  const baseUrl = getOptionalInput('base_url');
  const ignoreCertErrors = getBooleanInput('ignore_cert_errors', false);
  const force = getBooleanInput('force', false);
  const verbose = getBooleanInput('verbose', false);

  // Validate GPG signing requirements
  if (gpgSign && !tagMessage) {
    throw new Error('gpg_sign requires tag_message (GPG signing only works with annotated tags)');
  }

  // Validate GPG key ID if signing is enabled
  if (gpgSign && gpgKeyId && gpgKeyId.trim() === '') {
    throw new Error('gpg_key_id cannot be empty when gpg_sign is true');
  }

  // Validate base URL format if provided
  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch {
      throw new Error(`Invalid base_url format: ${baseUrl}`);
    }
  }

  return {
    tagName: tagName.trim(),
    tagMessage: tagMessage?.trim(),
    tagSha: tagSha?.trim(),
    repository: repository?.trim(),
    token: token || process.env.GITHUB_TOKEN,
    updateExisting,
    gpgSign,
    gpgKeyId: gpgKeyId?.trim(),
    repoType,
    baseUrl,
    ignoreCertErrors,
    force,
    verbose
  };
}

