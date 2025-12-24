import { PlatformAPI, TagOptions, TagResult, RepositoryInfo, PlatformConfig } from '../types';
import { Logger } from '../logger';
import { HttpClient } from './http-client';

/**
 * Bitbucket API client
 */
export class BitbucketAPI implements PlatformAPI {
  private client: HttpClient;
  private repoInfo: RepositoryInfo;
  private logger: Logger;

  constructor(repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger) {
    // Bitbucket uses different API versions for cloud vs server
    // Cloud: https://api.bitbucket.org/2.0
    // Server: https://<server>/rest/api/1.0
    const baseUrl = config.baseUrl || 'https://api.bitbucket.org/2.0';
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
      const path = `/repositories/${this.repoInfo.owner}/${this.repoInfo.repo}/refs/tags/${tagName}`;
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

    this.logger.info(`Creating Bitbucket tag: ${tagName} at ${sha}`);

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

    // Create tag via Bitbucket API
    const path = `/repositories/${this.repoInfo.owner}/${this.repoInfo.repo}/refs/tags`;
    const tagData = {
      name: tagName,
      target: {
        hash: sha
      },
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
    this.logger.info(`Deleting Bitbucket tag: ${tagName}`);
    const path = `/repositories/${this.repoInfo.owner}/${this.repoInfo.repo}/refs/tags/${tagName}`;
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

