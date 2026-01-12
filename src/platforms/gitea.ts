import { PlatformAPI, TagOptions, TagResult, RepositoryInfo, PlatformConfig } from '../types';
import { Logger } from '../logger';
import { HttpClient } from './http-client';

function normalizeGiteaBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  // If already points to an api path, keep it. Otherwise, append /api/v1.
  if (trimmed.match(/\/api\/v\d+$/)) {
    return trimmed;
  }
  return `${trimmed}/api/v1`;
}

/**
 * Gitea API client
 */
export class GiteaAPI implements PlatformAPI {
  private client: HttpClient;
  private repoInfo: RepositoryInfo;
  private logger: Logger;

  constructor(repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger) {
    const baseUrl = normalizeGiteaBaseUrl(config.baseUrl || 'https://gitea.com/api/v1');
    this.client = new HttpClient(
      {
        baseUrl,
        token: config.token,
        ignoreCertErrors: config.ignoreCertErrors,
        verbose: config.verbose
      },
      logger
    );
    this.repoInfo = repoInfo;
    this.logger = logger;
  }

  /**
   * Check if a tag exists
   */
  async tagExists(tagName: string): Promise<boolean> {
    try {
      const path = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs/tags/${tagName}`;
      await this.client.get(path);
      this.logger.debug(`Gitea tag ${tagName} exists`);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        this.logger.debug(`Gitea tag ${tagName} does not exist (404)`);
        return false;
      }
      this.logger.debug(`Gitea tagExists error for ${tagName}: ${error}`);
      throw error;
    }
  }

  /**
   * Create a tag
   */
  async createTag(options: TagOptions): Promise<TagResult> {
    const { tagName, sha, message } = options;

    this.logger.info(`Creating Gitea tag: ${tagName} at ${sha}`);
    
    // Debug logging for message
    if (options.verbose) {
      this.logger.debug(`Tag message: ${message === undefined ? 'undefined' : `length=${message.length}, value="${message.substring(0, 50).replace(/\n/g, '\\n')}${message.length > 50 ? '...' : ''}"`}`);
      // Additional verbose trace to help diagnose API behaviors in self-hosted Gitea
      // eslint-disable-next-line no-console
      console.log(`[GiteaAPI] createTag debug: force=${options.force}, tag=${tagName}`);
    }

    // Check if tag exists
    const existsOriginal = await this.tagExists(tagName);
    const updateRequested = !!options.force;

    if (existsOriginal && !updateRequested) {
      this.logger.warning(`Tag ${tagName} already exists`);
      return {
        tagName,
        sha,
        exists: true,
        created: false,
        updated: false
      };
    }

    // Delete existing tag if force is enabled
    if (existsOriginal && updateRequested) {
      await this.deleteTag(tagName);
    }

    // Attempt primary Gitea tag creation endpoint
    const createTagPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/tags`;
    const tagData = {
      tag_name: tagName,
      target: sha,
      message: message || `Tag ${tagName}`
    };

    const tryCreateViaRefs = async (): Promise<void> => {
      // Fallback: create a lightweight tag ref (works on older / stricter Gitea)
      const refPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs`;
      const payload = {
        ref: `refs/tags/${tagName}`,
        sha
      };
      this.logger.warning(`Primary Gitea tag create failed; falling back to refs API for ${tagName}`);
      await this.client.post(refPath, payload);
    };

    try {
      await this.client.post(createTagPath, tagData);
    } catch (error) {
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      // If the tag already exists and force is enabled, delete and retry
      if (msg.includes('409') && msg.includes('tag already exists')) {
        if (updateRequested) {
          // Force update: delete and retry
          this.logger.info(`Tag ${tagName} exists but force is enabled, deleting and recreating`);
          await this.deleteTag(tagName);
          // Retry creation
          try {
            await this.client.post(createTagPath, tagData);
          } catch (retryError) {
            // If retry also fails with 405/404, try fallback
            const retryMsg = retryError instanceof Error ? retryError.message.toLowerCase() : '';
            if (retryMsg.includes('405') || retryMsg.includes('404')) {
              await tryCreateViaRefs();
            } else {
              throw retryError;
            }
          }
        } else {
          // No force: surface a graceful result
          this.logger.warning(`Tag ${tagName} already exists (detected during create)`);
          return {
            tagName,
            sha,
            exists: true,
            created: false,
            updated: false
          };
        }
      } else {
        // Fallback to refs API on method/endpoint errors (405/404)
        if (msg.includes('405') || msg.includes('404')) {
          await tryCreateViaRefs();
        } else {
          throw error;
        }
      }
    }

    this.logger.info(`Tag created successfully: ${tagName}`);

    return {
      tagName,
      sha,
      exists: existsOriginal || updateRequested,
      created: !existsOriginal,
      updated: updateRequested
    };
  }

  /**
   * Update a tag (delete and recreate)
   */
  async updateTag(options: TagOptions): Promise<TagResult> {
    await this.deleteTag(options.tagName);
    return this.createTag({ ...options, force: true });
  }

  /**
   * Delete a tag
   */
  async deleteTag(tagName: string): Promise<void> {
    this.logger.info(`Deleting Gitea tag: ${tagName}`);
    // Delete the ref
    const path = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs/tags/${tagName}`;
    try {
      await this.client.delete(path);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('405'))) {
        this.logger.debug(`Tag ${tagName} does not exist, skipping delete`);
        return;
      }
      throw error;
    }
  }

  /**
   * Get the HEAD SHA from the default branch
   */
  async getHeadSha(): Promise<string> {
    // Get repository info to find default branch
    const repoPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}`;
    const repoInfo = await this.client.get<{ default_branch: string }>(repoPath);
    const defaultBranch = repoInfo.default_branch || 'main';

    // Get the HEAD SHA from the default branch
    // Gitea API returns an array for /git/refs/heads/ endpoint
    const refPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs/heads/${defaultBranch}`;
    const refInfoArray = await this.client.get<Array<{ object: { sha: string } }>>(refPath);
    if (refInfoArray.length === 0) {
      throw new Error(`No ref found for branch ${defaultBranch}`);
    }
    return refInfoArray[0].object.sha;
  }
}

