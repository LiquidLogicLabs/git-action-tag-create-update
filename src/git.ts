import * as exec from '@actions/exec';
import * as io from '@actions/io';
import { TagOptions, TagResult } from './types';
import { Logger } from './logger';

/**
 * Check if we're in a Git repository
 */
export async function isGitRepository(logger: Logger): Promise<boolean> {
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
  logger: Logger
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
export async function getHeadSha(logger: Logger): Promise<string> {
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
 * Create a tag using Git CLI
 */
export async function createTag(
  options: TagOptions,
  logger: Logger
): Promise<TagResult> {
  const { tagName, sha, message, gpgSign, gpgKeyId } = options;

  logger.info(`Creating tag: ${tagName} at ${sha}`);

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
  } else {
    tagArgs.push('-a'); // Annotated tag (if message provided)
  }

  tagArgs.push(tagName);

  if (sha) {
    tagArgs.push(sha);
  }

  // Create tag
  if (message) {
    logger.logGitCommand('git tag', tagArgs);
    await exec.exec('git', tagArgs, {
      input: Buffer.from(message),
      silent: !options.verbose
    });
  } else {
    // Lightweight tag
    logger.logGitCommand('git tag', [tagName, ...(sha ? [sha] : [])]);
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
    exists: false,
    created: true,
    updated: exists && options.force
  };
}

/**
 * Get the SHA that a tag points to
 */
export async function getTagSha(tagName: string, logger: Logger): Promise<string> {
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

  logger.logGitCommand('git', pushArgs);
  await exec.exec('git', pushArgs, {
    silent: false // Show output for push operations
  });
}

/**
 * Get remote URL
 */
async function getRemoteUrl(remote: string, logger: Logger): Promise<string | undefined> {
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

  logger.logGitCommand('git', ['push', remote, '--delete', tagName]);
  await exec.exec('git', ['push', remote, '--delete', tagName], {
    silent: true
  });
}

