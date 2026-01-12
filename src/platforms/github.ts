import { PlatformAPI, TagOptions, TagResult, RepositoryInfo, PlatformConfig, RepoType } from '../types';
import { Logger } from '../logger';
import { HttpClient } from './http-client';

/**
 * GitHub API client
 */
export class GitHubAPI implements PlatformAPI {
  private client: HttpClient;
  private repoInfo: RepositoryInfo;
  private logger: Logger;

  constructor(repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger) {
    const baseUrl = config.baseUrl || 'https://api.github.com';
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

    this.logger.info(`Creating GitHub tag: ${tagName} at ${sha}`);

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

    // Create tag object
    const tagObject = {
      tag: tagName,
      message: message || `Tag ${tagName}`,
      object: sha,
      type: 'commit'
    };

    const path = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/tags`;
    const tagResponse = await this.client.post<{ sha: string }>(path, tagObject);

    // Create ref pointing to the tag
    const refPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs`;
    try {
      await this.client.post(refPath, {
        ref: `refs/tags/${tagName}`,
        sha: tagResponse.sha
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      // If the ref already exists and force is enabled, delete and retry
      if ((msg.includes('422') || msg.includes('reference already exists')) && options.force) {
        this.logger.info(`Ref ${tagName} exists but force is enabled, deleting and recreating`);
        await this.deleteTag(tagName);
        // Retry ref creation
        await this.client.post(refPath, {
          ref: `refs/tags/${tagName}`,
          sha: tagResponse.sha
        });
      } else {
        throw error;
      }
    }

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
    this.logger.info(`Deleting GitHub tag: ${tagName}`);
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

  /**
   * Get the HEAD SHA from the default branch
   */
  async getHeadSha(): Promise<string> {
    // Get repository info to find default branch
    const repoPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}`;
    const repoInfo = await this.client.get<{ default_branch: string }>(repoPath);
    const defaultBranch = repoInfo.default_branch || 'main';

    // Get the HEAD SHA from the default branch
    const refPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/ref/heads/${defaultBranch}`;
    const refInfo = await this.client.get<{ object: { sha: string } }>(refPath);
    return refInfo.object.sha;
  }
}

export function detectFromUrlByHostname(url: URL): RepoType | undefined {
  const hostname = url.hostname.toLowerCase();
  if (hostname.includes('github.com')) {
    return 'github';
  }
  return undefined;
}

async function headOk(url: string, logger: Logger): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok || response.status === 401 || response.status === 403) {
      logger.debug(`GitHub detect: ${url} status ${response.status}`);
      return true;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      logger.debug(`GitHub detect timeout: ${url}`);
    }
  }
  return false;
}

export async function detectFromUrl(url: URL, logger: Logger): Promise<RepoType | undefined> {
  const base = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
  const paths = ['/api/v3', '/api'];
  for (const path of paths) {
    if (await headOk(`${base}${path}`, logger)) {
      return 'github';
    }
  }
  return undefined;
}

export function determineBaseUrl(urls: string | string[]): string | undefined {
  const urlArray = Array.isArray(urls) ? urls : [urls];

  // If explicitly provided base URL exists, use it (would be in the array)
  for (const urlStr of urlArray) {
    if (!urlStr) continue;
    try {
      const url = new URL(urlStr);
      // Check if this looks like an API URL
      if (url.pathname.includes('/api')) {
        return urlStr;
      }
    } catch {
      // Not a valid URL, skip
    }
  }

  // Default GitHub API URL
  return 'https://api.github.com';
}
