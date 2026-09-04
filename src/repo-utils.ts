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

    // Extract owner/repo from path
    const pathParts = url.pathname.split('/').filter(p => p);
    if (pathParts.length >= 2) {
      const owner = pathParts[0];
      const repo = pathParts[1].replace(/\.git$/, '');

      logger.debug(`Parsed URL: ${url.href} -> ${owner}/${repo}`);

      return {
        owner,
        repo,
        url: url.href,
        platform: 'auto' // Platform detection is handled by the factory
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
      platform: 'auto' // Platform detection is handled by the factory
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

    // Get remote URL - if no remote origin, assume local git (generic)
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
      logger.debug('No remote origin found, will use local git (generic)');
      // No remote origin - return undefined so caller can use generic
      return undefined;
    }

    // If we have a remote URL, parse it
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

  // If still no info, try environment variables as fallback
  if (!repoInfo) {
    // Check Gitea first (since Gitea Actions sets GITHUB_REPOSITORY for compatibility)
    const giteaRepo = process.env.GITEA_REPOSITORY;
    const giteaServerUrl = process.env.GITEA_SERVER_URL || process.env.GITEA_API_URL;
    const githubServerUrl = process.env.GITHUB_SERVER_URL;
    
    if (giteaRepo) {
      const [owner, repo] = giteaRepo.split('/');
      repoInfo = {
        owner,
        repo,
        platform: 'auto' // Platform detection is handled by the factory
      };
      logger.debug(`Using GITEA_REPOSITORY: ${owner}/${repo}`);
    } else if (giteaServerUrl || (githubServerUrl && !githubServerUrl.includes('github.com'))) {
      // Gitea server URL or GITHUB_SERVER_URL set to non-GitHub URL indicates Gitea
      const githubRepo = process.env.GITHUB_REPOSITORY;
      if (githubRepo) {
        const [owner, repo] = githubRepo.split('/');
        repoInfo = {
          owner,
          repo,
          platform: 'auto' // Platform detection is handled by the factory
        };
        logger.debug(`Using GITHUB_REPOSITORY with Gitea server URL: ${owner}/${repo}`);
      }
    } else if (process.env.GITHUB_REPOSITORY) {
      const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
      repoInfo = {
        owner,
        repo,
        platform: 'auto' // Platform detection is handled by the factory
      };
      logger.debug(`Using GITHUB_REPOSITORY: ${owner}/${repo}`);
    }
  }

  // If we still don't have info, throw error
  if (!repoInfo) {
    throw new Error(
      'Could not determine repository information. Please provide repository input or run in a Git repository.'
    );
  }

  // Platform detection is handled by the factory, not here
  logger.info(`Repository: ${repoInfo.owner}/${repoInfo.repo}`);

  return repoInfo;
}

/**
 * Encode a value for use as a single path segment in an API URL.
 *
 * Interpolating a value straight into a path lets it redirect the request. Verified against
 * WHATWG URL resolution, which is what fetch applies:
 *
 *   tag "../../../user"  ->  /repos/o/r/git/refs/tags/../../../user  =>  /repos/o/user
 *   tag ".."             ->  /repos/o/r/git/refs/tags/..             =>  /repos/o/r/git/refs/
 *
 * This action issues DELETE against these paths (deleteTag on every platform client), so a
 * redirected request acts on the refs collection rather than on one tag.
 *
 * encodeURIComponent is necessary but not sufficient: it does not encode dots, so a bare
 * "." or ".." survives it unchanged and is then removed by dot-segment normalisation. Those
 * two are refused outright rather than encoded, because no legitimate tag, owner, repo or
 * branch is named "." or "..".
 */
export function safeSegment(value: string, label: string): string {
  if (value === '.' || value === '..') {
    throw new Error(
      `Refusing to use ${JSON.stringify(value)} as a ${label}: it would redirect the request to a different endpoint.`
    );
  }
  return encodeURIComponent(value);
}
