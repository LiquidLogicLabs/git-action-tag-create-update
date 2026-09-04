import { PlatformAPI, TagOptions, TagResult, RepositoryInfo, PlatformConfig, RepoType } from '../types';
import { Logger } from '../logger';
import { HttpClient } from './http-client';
import { safeSegment } from '../repo-utils';

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
      const path = `/repos/${safeSegment(this.repoInfo.owner, 'repository owner')}/${safeSegment(this.repoInfo.repo, 'repository name')}/git/refs/tags/${safeSegment(tagName, 'tag name')}`;
      const response = await this.client.get<unknown>(path);
      // GitHub answers this endpoint with every ref whose name STARTS WITH tagName, so a
      // 200 does not mean the tag exists: asking for `v1` returns `refs/tags/v1.2.3`.
      // Floating tags (v1, v1.2) are the main use of this action, so match exactly.
      const found = this.matchesExactRef(response, tagName);
      return found;
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

    const path = `/repos/${safeSegment(this.repoInfo.owner, 'repository owner')}/${safeSegment(this.repoInfo.repo, 'repository name')}/git/tags`;
    const tagResponse = await this.client.post<{ sha: string }>(path, tagObject);

    // Create ref pointing to the tag
    const refPath = `/repos/${safeSegment(this.repoInfo.owner, 'repository owner')}/${safeSegment(this.repoInfo.repo, 'repository name')}/git/refs`;
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
    // Delete-then-recreate is destructive: if the recreate fails the repository is left
    // with no tag at all. Remember where the ref pointed so it can be restored.
    const previousSha = await this.getExistingRefSha(options.tagName);

    await this.deleteTag(options.tagName);

    try {
      const result = await this.createTag(options);
      return { ...result, exists: true, created: false, updated: true };
    } catch (error) {
      if (previousSha) {
        try {
          await this.client.post(`/repos/${safeSegment(this.repoInfo.owner, 'repository owner')}/${safeSegment(this.repoInfo.repo, 'repository name')}/git/refs`, {
            ref: `refs/tags/${options.tagName}`,
            sha: previousSha
          });
          this.logger.warning(
            `Updating tag ${options.tagName} failed; restored it to its previous object ${previousSha}`
          );
        } catch (restoreError) {
          this.logger.error(
            `Updating tag ${options.tagName} failed AND the previous tag could not be restored. ` +
              `It pointed at ${previousSha}; recreate it manually. Restore error: ${restoreError}`
          );
        }
      }
      throw error;
    }
  }

  /**
   * Delete a tag
   */
  /**
   * True when the refs response contains a ref for exactly this tag.
   */
  private matchesExactRef(response: unknown, tagName: string): boolean {
    const wanted = `refs/tags/${tagName}`;
    const refs = Array.isArray(response) ? response : [response];
    return refs.some(
      (ref) => typeof ref === 'object' && ref !== null && (ref as { ref?: string }).ref === wanted
    );
  }

  /**
   * SHA the tag ref currently points at, so a failed update can put it back.
   */
  private async getExistingRefSha(tagName: string): Promise<string | undefined> {
    try {
      const path = `/repos/${safeSegment(this.repoInfo.owner, 'repository owner')}/${safeSegment(this.repoInfo.repo, 'repository name')}/git/refs/tags/${safeSegment(tagName, 'tag name')}`;
      const response = await this.client.get<unknown>(path);
      const wanted = `refs/tags/${tagName}`;
      const refs = Array.isArray(response) ? response : [response];
      const match = refs.find(
        (ref) => typeof ref === 'object' && ref !== null && (ref as { ref?: string }).ref === wanted
      ) as { object?: { sha?: string } } | undefined;
      return match?.object?.sha;
    } catch (error) {
      this.logger.debug(`Could not read existing tag ref ${tagName}: ${error}`);
      return undefined;
    }
  }

  async deleteTag(tagName: string): Promise<void> {
    this.logger.info(`Deleting GitHub tag: ${tagName}`);
    const path = `/repos/${safeSegment(this.repoInfo.owner, 'repository owner')}/${safeSegment(this.repoInfo.repo, 'repository name')}/git/refs/tags/${safeSegment(tagName, 'tag name')}`;
    try {
      await this.client.delete(path);
    } catch (error) {
      // Deleting a ref GitHub does not have answers 422 "Reference does not exist",
      // not 404, so the 404 branch alone never actually tolerated a missing tag. The
      // 422 check is deliberately narrow: other 422s from this endpoint are real errors.
      if (error instanceof Error && this.isMissingRefError(error)) {
        this.logger.debug(`Tag ${tagName} does not exist, skipping delete`);
        return;
      }
      throw error;
    }
  }

  /**
   * True when an error means "the ref is not there", which is a no-op for a delete.
   */
  private isMissingRefError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    if (msg.includes('404')) {
      return true;
    }
    return msg.includes('422') && msg.includes('reference does not exist');
  }

  /**
   * Get the HEAD SHA from the default branch
   */
  async getHeadSha(): Promise<string> {
    // Get repository info to find default branch
    const repoPath = `/repos/${safeSegment(this.repoInfo.owner, 'repository owner')}/${safeSegment(this.repoInfo.repo, 'repository name')}`;
    const repoInfo = await this.client.get<{ default_branch: string }>(repoPath);
    const defaultBranch = repoInfo.default_branch || 'main';

    // Get the HEAD SHA from the default branch
    const refPath = `/repos/${safeSegment(this.repoInfo.owner, 'repository owner')}/${safeSegment(this.repoInfo.repo, 'repository name')}/git/ref/heads/${safeSegment(defaultBranch, 'default branch')}`;
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
