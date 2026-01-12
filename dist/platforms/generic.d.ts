import { PlatformAPI, TagOptions, TagResult, RepositoryInfo, PlatformConfig, RepoType } from '../types';
import { Logger } from '../logger';
/**
 * Generic Git CLI platform implementation
 * Uses Git CLI for all operations
 */
export declare class GenericGitAPI implements PlatformAPI {
    private repoInfo;
    private config;
    private logger;
    constructor(repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger);
    /**
     * Check if a tag exists
     */
    tagExists(tagName: string): Promise<boolean>;
    /**
     * Create a tag
     */
    createTag(options: TagOptions): Promise<TagResult>;
    /**
     * Update a tag (delete and recreate)
     */
    updateTag(options: TagOptions): Promise<TagResult>;
    /**
     * Delete a tag
     */
    deleteTag(tagName: string): Promise<void>;
    /**
     * Get the HEAD SHA from the default branch (local Git only)
     */
    getHeadSha(): Promise<string>;
}
export declare function detectFromUrlByHostname(_url: URL): RepoType | undefined;
export declare function detectFromUrl(_url: URL, _logger: Logger): Promise<RepoType | undefined>;
export declare function determineBaseUrl(_urls: string | string[]): string | undefined;
//# sourceMappingURL=generic.d.ts.map