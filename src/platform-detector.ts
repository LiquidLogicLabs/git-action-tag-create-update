import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import { RepoType, RepositoryInfo } from './types';
import { Logger } from './logger';

/**
 * Parse repository URL or owner/repo format
 */
export function parseRepository(
  repository: string | undefined,
  logger: Logger
): RepositoryInfo | undefined {
  if (!repository) {
    return undefined;
  }

  logger.debug(`Parsing repository: ${repository}`);

  // Try to parse as URL first
  try {
    const url = new URL(repository);
    const hostname = url.hostname.toLowerCase();

    // Extract owner/repo from path
    const pathParts = url.pathname.split('/').filter(p => p);
    if (pathParts.length >= 2) {
      const owner = pathParts[0];
      const repo = pathParts[1].replace(/\.git$/, '');

      // Detect platform from hostname
      let platform: RepoType = 'generic';
      if (hostname.includes('github.com') || hostname.includes('github.enterprise')) {
        platform = 'github';
      } else if (hostname.includes('gitea.com') || hostname.includes('gitea')) {
        platform = 'gitea';
      } else if (hostname.includes('bitbucket.org') || hostname.includes('bitbucket')) {
        platform = 'bitbucket';
      }

      logger.debug(`Detected platform: ${platform} from URL: ${url.href}`);

      return {
        owner,
        repo,
        url: url.href,
        platform
      };
    }
  } catch {
    // Not a URL, try owner/repo format
  }

  // Try owner/repo format (e.g., "owner/repo")
  const parts = repository.split('/');
  if (parts.length === 2) {
    logger.debug(`Parsed as owner/repo format: ${parts[0]}/${parts[1]}`);
    return {
      owner: parts[0],
      repo: parts[1],
      platform: 'auto' // Will be detected later
    };
  }

  logger.warning(`Could not parse repository format: ${repository}`);
  return undefined;
}

/**
 * Get repository info from local Git repository
 */
export async function getLocalRepositoryInfo(
  logger: Logger
): Promise<RepositoryInfo | undefined> {
  const gitPath = await io.which('git', true);
  if (!gitPath) {
    logger.debug('Git not found in PATH');
    return undefined;
  }

  // Check if we're in a Git repository
  try {
    const exitCode = await exec.exec('git', ['rev-parse', '--git-dir'], {
      silent: true,
      ignoreReturnCode: true
    });

    if (exitCode !== 0) {
      logger.debug('Not in a Git repository');
      return undefined;
    }

    // Get remote URL
    let remoteUrl = '';
    try {
      const output: string[] = [];
      await exec.exec('git', ['config', '--get', 'remote.origin.url'], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            output.push(data.toString());
          }
        }
      });
      remoteUrl = output.join('').trim();
    } catch {
      logger.debug('Could not get remote URL');
    }

    // Get current repository info from GitHub context if available
    const githubRepo = process.env.GITHUB_REPOSITORY;
    if (githubRepo) {
      const [owner, repo] = githubRepo.split('/');
      logger.debug(`Using GitHub context: ${owner}/${repo}`);
      return {
        owner,
        repo,
        url: remoteUrl || undefined,
        platform: 'github'
      };
    }

    // Try to parse remote URL
    if (remoteUrl) {
      const parsed = parseRepository(remoteUrl, logger);
      if (parsed) {
        return parsed;
      }
    }

    logger.debug('Could not determine repository info from local Git repo');
    return undefined;
  } catch (error) {
    logger.debug(`Error checking local repository: ${error}`);
    return undefined;
  }
}

/**
 * Detect platform from repository info or explicit repo type
 */
export function detectPlatform(
  repoType: RepoType,
  repositoryInfo: RepositoryInfo | undefined,
  logger: Logger
): RepoType {
  // If explicit type is provided and not 'auto', use it
  if (repoType !== 'auto') {
    logger.debug(`Using explicit repo_type: ${repoType}`);
    return repoType;
  }

  // If we have repository info with a detected platform, use it
  if (repositoryInfo && repositoryInfo.platform !== 'auto') {
    logger.debug(`Detected platform from repository: ${repositoryInfo.platform}`);
    return repositoryInfo.platform;
  }

  // Try to detect from GitHub context
  if (process.env.GITHUB_REPOSITORY) {
    logger.debug('Detected GitHub from GITHUB_REPOSITORY context');
    return 'github';
  }

  // Fallback to generic
  logger.debug('Could not detect platform, using generic');
  return 'generic';
}

/**
 * Get full repository information
 */
export async function getRepositoryInfo(
  repository: string | undefined,
  repoType: RepoType,
  logger: Logger
): Promise<RepositoryInfo> {
  let repoInfo: RepositoryInfo | undefined;

  // Try to parse provided repository
  if (repository) {
    repoInfo = parseRepository(repository, logger);
  }

  // If not provided or couldn't parse, try local repository
  if (!repoInfo) {
    repoInfo = await getLocalRepositoryInfo(logger);
  }

  // If still no info, try GitHub context
  if (!repoInfo) {
    const githubRepo = process.env.GITHUB_REPOSITORY;
    if (githubRepo) {
      const [owner, repo] = githubRepo.split('/');
      repoInfo = {
        owner,
        repo,
        platform: 'github'
      };
      logger.debug(`Using GitHub context: ${owner}/${repo}`);
    }
  }

  // If we still don't have info, throw error
  if (!repoInfo) {
    throw new Error(
      'Could not determine repository information. Please provide repository input or run in a Git repository.'
    );
  }

  // Detect platform
  const platform = detectPlatform(repoType, repoInfo, logger);
  repoInfo.platform = platform;

  logger.info(`Repository: ${repoInfo.owner}/${repoInfo.repo}, Platform: ${platform}`);

  return repoInfo;
}

