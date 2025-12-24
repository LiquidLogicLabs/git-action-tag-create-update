import { PlatformAPI, TagOptions, TagResult, RepositoryInfo, PlatformConfig } from '../types';
import { Logger } from '../logger';
import * as exec from '@actions/exec';
import {
  tagExistsLocally,
  createTag as createTagLocal,
  pushTag,
  deleteTagRemote,
  deleteTagLocally,
  getHeadSha
} from '../git';

/**
 * Generic Git CLI platform implementation
 * Uses Git CLI for all operations
 */
export class GenericGitAPI implements PlatformAPI {
  private repoInfo: RepositoryInfo;
  private config: PlatformConfig;
  private logger: Logger;

  constructor(repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger) {
    this.repoInfo = repoInfo;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Check if a tag exists
   */
  async tagExists(tagName: string): Promise<boolean> {
    return tagExistsLocally(tagName, this.logger);
  }

  /**
   * Create a tag
   */
  async createTag(options: TagOptions): Promise<TagResult> {
    this.logger.info(`Creating tag using Git CLI: ${options.tagName}`);

    // Get SHA if not provided
    let sha = options.sha;
    if (!sha) {
      sha = await getHeadSha(this.logger);
    }

    // Create tag locally
    const result = await createTagLocal(
      {
        ...options,
        sha
      },
      this.logger
    );

    // Push to remote if we have repository info
    if (this.repoInfo.url) {
      try {
        await pushTag(
          options.tagName,
          'origin',
          this.config.token,
          options.force,
          this.logger
        );
      } catch (error) {
        this.logger.warning(`Failed to push tag to remote: ${error}`);
        // Continue anyway - tag was created locally
      }
    }

    return result;
  }

  /**
   * Update a tag (delete and recreate)
   */
  async updateTag(options: TagOptions): Promise<TagResult> {
    this.logger.info(`Updating tag using Git CLI: ${options.tagName}`);

    // Delete from remote first if exists
    if (this.repoInfo.url) {
      try {
        await deleteTagRemote(
          options.tagName,
          'origin',
          this.config.token,
          this.logger
        );
      } catch (error) {
        this.logger.debug(`Tag may not exist remotely: ${error}`);
      }
    }

    // Create new tag (which will overwrite local if force is enabled)
    return this.createTag(options);
  }

  /**
   * Delete a tag
   */
  async deleteTag(tagName: string): Promise<void> {
    this.logger.info(`Deleting tag using Git CLI: ${tagName}`);

    // Delete from remote if we have repository info
    if (this.repoInfo.url) {
      try {
        await deleteTagRemote(tagName, 'origin', this.config.token, this.logger);
      } catch (error) {
        this.logger.debug(`Tag may not exist remotely: ${error}`);
      }
    }

    // Delete locally
    await deleteTagLocally(tagName, this.logger);
  }
}

