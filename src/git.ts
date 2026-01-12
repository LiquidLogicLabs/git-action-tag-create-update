import * as exec from '@actions/exec';
import { TagOptions, TagResult } from './types';
import { Logger } from './logger';

/**
 * Check if we're in a Git repository
 */
export async function isGitRepository(_logger: Logger): Promise<boolean> {
  try {
    const exitCode = await exec.exec('git', ['rev-parse', '--git-dir'], {
      silent: true,
      ignoreReturnCode: true
    });
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Check if a tag exists locally
 */
export async function tagExistsLocally(
  tagName: string,
  _logger: Logger
): Promise<boolean> {
  try {
    const exitCode = await exec.exec(
      'git',
      ['rev-parse', '--verify', `refs/tags/${tagName}`],
      {
        silent: true,
        ignoreReturnCode: true
      }
    );
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get current HEAD SHA
 */
export async function getHeadSha(_logger: Logger): Promise<string> {
  const output: string[] = [];
  await exec.exec('git', ['rev-parse', 'HEAD'], {
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        output.push(data.toString());
      }
    }
  });
  return output.join('').trim();
}

/**
 * Ensure git user.name and user.email are configured
 * Returns true if configuration was set, false if already configured
 */
export async function ensureGitUserConfig(
  logger: Logger,
  userName?: string,
  userEmail?: string
): Promise<boolean> {
  // Check if git config is already set
  let nameSet = false;
  let emailSet = false;

  try {
    const nameOutput: string[] = [];
    await exec.exec('git', ['config', '--get', 'user.name'], {
      silent: true,
      listeners: {
        stdout: (data: Buffer) => {
          nameOutput.push(data.toString());
        }
      },
      ignoreReturnCode: true
    });
    nameSet = nameOutput.join('').trim().length > 0;
  } catch {
    nameSet = false;
  }

  try {
    const emailOutput: string[] = [];
    await exec.exec('git', ['config', '--get', 'user.email'], {
      silent: true,
      listeners: {
        stdout: (data: Buffer) => {
          emailOutput.push(data.toString());
        }
      },
      ignoreReturnCode: true
    });
    emailSet = emailOutput.join('').trim().length > 0;
  } catch {
    emailSet = false;
  }

  // If both are already set, no need to configure
  if (nameSet && emailSet) {
    logger.debug('Git user.name and user.email already configured');
    return false;
  }

  // Determine values to use
  let finalName = userName;
  let finalEmail = userEmail;

  // Auto-detect from environment variables if not provided
  if (!finalName) {
    finalName =
      process.env.GITHUB_ACTOR ||
      process.env.GITEA_ACTOR ||
      process.env.CI_COMMIT_AUTHOR ||
      'GitHub Actions';
  }

  if (!finalEmail) {
    // Try to construct email from actor
    const actor =
      process.env.GITHUB_ACTOR ||
      process.env.GITEA_ACTOR ||
      process.env.CI_COMMIT_AUTHOR;
    if (actor) {
      // Determine platform and use appropriate noreply email format
      const githubServerUrl = process.env.GITHUB_SERVER_URL;
      const giteaServerUrl = process.env.GITEA_SERVER_URL;
      
      if (githubServerUrl || process.env.GITHUB_ACTOR) {
        // GitHub format: actor@users.noreply.{hostname}
        const hostname = githubServerUrl
          ? githubServerUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
          : 'github.com';
        finalEmail = `${actor}@users.noreply.${hostname}`;
      } else if (giteaServerUrl || process.env.GITEA_ACTOR) {
        // Gitea format: actor@noreply.{hostname}
        const hostname = giteaServerUrl
          ? giteaServerUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
          : 'gitea.com';
        finalEmail = `${actor}@noreply.${hostname}`;
      } else {
        // Default format for other platforms
        const serverUrl = process.env.CI_SERVER_URL || 'github.com';
        const hostname = serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        finalEmail = `${actor}@noreply.${hostname}`;
      }
    } else {
      finalEmail = 'actions@github.com';
    }
  }

  // Set git config (local to repository)
  if (!nameSet && finalName) {
    logger.debug(`Setting git user.name to: ${finalName}`);
    await exec.exec('git', ['config', '--local', 'user.name', finalName], {
      silent: true
    });
  }

  if (!emailSet && finalEmail) {
    logger.debug(`Setting git user.email to: ${finalEmail}`);
    await exec.exec('git', ['config', '--local', 'user.email', finalEmail], {
      silent: true
    });
  }

  return true;
}

/**
 * Create a tag using Git CLI
 */
export async function createTag(
  options: TagOptions,
  logger: Logger
): Promise<TagResult> {
  const { tagName, sha, message, gpgSign, gpgKeyId, gitUserName, gitUserEmail } =
    options;

  logger.info(`Creating tag: ${tagName} at ${sha}`);

  // Debug logging for message processing
  if (options.verbose) {
    logger.debug(`Message before normalization: ${message === undefined ? 'undefined' : `length=${message?.length}, value="${message?.substring(0, 50).replace(/\n/g, '\\n')}${(message?.length || 0) > 50 ? '...' : ''}"`}`);
  }

  // Normalize empty message strings to undefined (treat as lightweight tag)
  const normalizedMessage = message?.trim() || undefined;

  if (options.verbose) {
    logger.debug(`Message after normalization: ${normalizedMessage === undefined ? 'undefined (will create lightweight tag)' : `length=${normalizedMessage.length} (will create annotated tag)`}`);
  }

  // Determine if this will be an annotated tag
  const isAnnotatedTag = !!normalizedMessage || gpgSign;

  // Ensure git user config is set for annotated tags (required by Git)
  if (isAnnotatedTag) {
    await ensureGitUserConfig(logger, gitUserName, gitUserEmail);
  }

  // Check if tag already exists
  const exists = await tagExistsLocally(tagName, logger);
  if (exists && !options.force) {
    logger.warning(`Tag ${tagName} already exists locally`);
    return {
      tagName,
      sha,
      exists: true,
      created: false,
      updated: false
    };
  }

  // Delete existing tag if force is enabled
  if (exists && options.force) {
    logger.info(`Deleting existing tag: ${tagName}`);
    await exec.exec('git', ['tag', '-d', tagName], {
      silent: !options.verbose
    });
  }

  // Build tag command
  const tagArgs: string[] = [];

  if (gpgSign) {
    tagArgs.push('-s');
    if (gpgKeyId) {
      tagArgs.push('-u', gpgKeyId);
    }
    // For GPG signed tags, use -F - to read message from stdin
    if (normalizedMessage) {
      tagArgs.push('-F', '-');
    }
  } else if (normalizedMessage) {
    // Only add -a flag if message is provided (annotated tag)
    tagArgs.push('-a', '-F', '-');
  }

  tagArgs.push(tagName);

  if (sha) {
    tagArgs.push(sha);
  }

  // Create tag
  if (normalizedMessage) {
    logger.debug(`Git command: git tag ${tagArgs.join(' ')}`);
    await exec.exec('git', ['tag', ...tagArgs], {
      input: Buffer.from(normalizedMessage),
      silent: !options.verbose
    });
  } else {
    // Lightweight tag
    const lightweightArgs = [tagName, ...(sha ? [sha] : [])];
    logger.debug(`Git command: git tag ${lightweightArgs.join(' ')}`);
    await exec.exec('git', ['tag', tagName, ...(sha ? [sha] : [])], {
      silent: !options.verbose
    });
  }

  // Verify tag was created
  const tagSha = await getTagSha(tagName, logger);
  logger.info(`Tag created successfully: ${tagName} -> ${tagSha}`);

  return {
    tagName,
    sha: tagSha,
    exists,
    created: true,
    updated: exists && options.force
  };
}

/**
 * Get the SHA that a tag points to
 */
export async function getTagSha(tagName: string, _logger: Logger): Promise<string> {
  const output: string[] = [];
  await exec.exec('git', ['rev-parse', `refs/tags/${tagName}`], {
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        output.push(data.toString());
      }
    }
  });
  return output.join('').trim();
}

/**
 * Push tag to remote
 */
export async function pushTag(
  tagName: string,
  remote: string,
  token: string | undefined,
  force: boolean,
  logger: Logger
): Promise<void> {
  logger.info(`Pushing tag ${tagName} to ${remote}`);

  // Configure Git with token if provided
  if (token) {
    // Extract URL from remote to inject token
    const remoteUrl = await getRemoteUrl(remote, logger);
    if (remoteUrl) {
      const urlWithToken = injectTokenIntoUrl(remoteUrl, token);
      await exec.exec('git', ['remote', 'set-url', remote, urlWithToken], {
        silent: true
      });
    }
  }

  const pushArgs = ['push', remote, tagName];
  if (force) {
    pushArgs.push('--force');
  }

  logger.debug(`Git command: git ${pushArgs.join(' ')}`);
  await exec.exec('git', pushArgs, {
    silent: false // Show output for push operations
  });
}

/**
 * Get remote URL
 */
async function getRemoteUrl(remote: string, _logger: Logger): Promise<string | undefined> {
  const output: string[] = [];
  try {
    await exec.exec('git', ['config', '--get', `remote.${remote}.url`], {
      silent: true,
      listeners: {
        stdout: (data: Buffer) => {
          output.push(data.toString());
        }
      }
    });
    return output.join('').trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Inject token into Git URL
 */
function injectTokenIntoUrl(url: string, token: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.username = token;
    urlObj.password = '';
    return urlObj.toString();
  } catch {
    // If URL parsing fails, try to inject token manually
    if (url.startsWith('https://')) {
      return url.replace('https://', `https://${token}@`);
    }
    if (url.startsWith('http://')) {
      return url.replace('http://', `http://${token}@`);
    }
    return url;
  }
}

/**
 * Delete a tag locally
 */
export async function deleteTagLocally(
  tagName: string,
  logger: Logger
): Promise<void> {
  logger.info(`Deleting local tag: ${tagName}`);
  await exec.exec('git', ['tag', '-d', tagName], {
    silent: true,
    ignoreReturnCode: true
  });
}

/**
 * Delete a tag from remote
 */
export async function deleteTagRemote(
  tagName: string,
  remote: string,
  token: string | undefined,
  logger: Logger
): Promise<void> {
  logger.info(`Deleting remote tag: ${tagName} from ${remote}`);

  // Configure Git with token if provided
  if (token) {
    const remoteUrl = await getRemoteUrl(remote, logger);
    if (remoteUrl) {
      const urlWithToken = injectTokenIntoUrl(remoteUrl, token);
      await exec.exec('git', ['remote', 'set-url', remote, urlWithToken], {
        silent: true
      });
    }
  }

  logger.debug(`Git command: git push ${remote} --delete ${tagName}`);
  await exec.exec('git', ['push', remote, '--delete', tagName], {
    silent: true
  });
}

