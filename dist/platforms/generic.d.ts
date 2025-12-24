import { PlatformAPI, TagOptions, TagResult, RepositoryInfo, PlatformConfig } from '../types';
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
}
//# sourceMappingURL=generic.d.ts.map