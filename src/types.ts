/**
 * Supported repository/platform types
 */
export type RepoType = 'github' | 'gitea' | 'bitbucket' | 'generic' | 'auto';

/**
 * Tag type (determined by presence of message)
 */
export type TagType = 'annotated' | 'lightweight';

/**
 * Action inputs
 */
export interface ActionInputs {
  tagName: string;
  tagMessage?: string;
  tagSha?: string;
  repository?: string;
  token?: string;
  updateExisting: boolean;
  gpgSign: boolean;
  gpgKeyId?: string;
  repoType: RepoType;
  baseUrl?: string;
  ignoreCertErrors: boolean;
  force: boolean;
  verbose: boolean;
  pushTag: boolean;
}

/**
 * Action outputs
 */
export interface ActionOutputs {
  tagName: string;
  tagSha: string;
  tagExists: boolean;
  tagUpdated: boolean;
  tagCreated: boolean;
  platform: string;
}

/**
 * Platform configuration
 */
export interface PlatformConfig {
  type: RepoType;
  baseUrl?: string;
  token?: string;
  ignoreCertErrors: boolean;
  verbose: boolean;
  pushTag?: boolean;
}

/**
 * Repository information
 */
export interface RepositoryInfo {
  owner: string;
  repo: string;
  url?: string;
  platform: RepoType;
}

/**
 * Tag operation options
 */
export interface TagOptions {
  tagName: string;
  sha: string;
  message?: string;
  gpgSign: boolean;
  gpgKeyId?: string;
  force: boolean;
  verbose: boolean;
}

/**
 * Tag operation result
 */
export interface TagResult {
  tagName: string;
  sha: string;
  exists: boolean;
  created: boolean;
  updated: boolean;
}

/**
 * Platform API interface
 */
export interface PlatformAPI {
  /**
   * Check if a tag exists
   */
  tagExists(tagName: string): Promise<boolean>;

  /**
   * Create a new tag
   */
  createTag(options: TagOptions): Promise<TagResult>;

  /**
   * Update an existing tag (delete and recreate)
   */
  updateTag(options: TagOptions): Promise<TagResult>;

  /**
   * Delete a tag
   */
  deleteTag(tagName: string): Promise<void>;
}

/**
 * HTTP client options for platform APIs
 */
export interface HttpClientOptions {
  baseUrl: string;
  token?: string;
  ignoreCertErrors: boolean;
  verbose: boolean;
}

