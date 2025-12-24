import { PlatformAPI, TagOptions, TagResult, RepositoryInfo, PlatformConfig } from '../types';
import { Logger } from '../logger';
import { HttpClient } from './http-client';

/**
 * Gitea API client
 */
export class GiteaAPI implements PlatformAPI {
  private client: HttpClient;
  private repoInfo: RepositoryInfo;
  private logger: Logger;

  constructor(repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger) {
    const baseUrl = config.baseUrl || 'https://gitea.com/api/v1';
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
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Create a tag
   */
  async createTag(options: TagOptions): Promise<TagResult> {
    const { tagName, sha, message } = options;

    this.logger.info(`Creating Gitea tag: ${tagName} at ${sha}`);

    // Check if tag exists
    const exists = await this.tagExists(tagName);
    if (exists && !options.force) {
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
    if (exists && options.force) {
      await this.deleteTag(tagName);
    }

    // Create tag via Gitea API
    // Gitea uses a different endpoint structure
    const path = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/tags`;
    const tagData = {
      tag_name: tagName,
      target: sha,
      message: message || `Tag ${tagName}`
    };

    await this.client.post(path, tagData);

    this.logger.info(`Tag created successfully: ${tagName}`);

    return {
      tagName,
      sha,
      exists: false,
      created: true,
      updated: exists && options.force
    };
  }

  /**
   * Update a tag (delete and recreate)
   */
  async updateTag(options: TagOptions): Promise<TagResult> {
    await this.deleteTag(options.tagName);
    return this.createTag(options);
  }

  /**
   * Delete a tag
   */
  async deleteTag(tagName: string): Promise<void> {
    this.logger.info(`Deleting Gitea tag: ${tagName}`);
    // Gitea doesn't have a direct delete tag endpoint via API
    // We need to delete the ref
    const path = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs/tags/${tagName}`;
    try {
      await this.client.delete(path);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        this.logger.debug(`Tag ${tagName} does not exist, skipping delete`);
        return;
      }
      throw error;
    }
  }
}

