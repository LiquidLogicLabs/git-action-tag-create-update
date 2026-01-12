import { PlatformAPI, TagOptions, TagResult, RepositoryInfo, PlatformConfig, RepoType } from '../types';
import { Logger } from '../logger';
/**
 * Bitbucket API client
 */
export declare class BitbucketAPI implements PlatformAPI {
    private client;
    private repoInfo;
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
     * Get the HEAD SHA from the default branch
     */
    getHeadSha(): Promise<string>;
}
export declare function detectFromUrlByHostname(url: URL): RepoType | undefined;
export declare function detectFromUrl(url: URL, logger: Logger): Promise<RepoType | undefined>;
export declare function determineBaseUrl(_urls: string | string[]): string | undefined;
//# sourceMappingURL=bitbucket.d.ts.map