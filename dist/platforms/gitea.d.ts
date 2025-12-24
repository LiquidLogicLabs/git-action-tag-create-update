import { PlatformAPI, TagOptions, TagResult, RepositoryInfo, PlatformConfig } from '../types';
import { Logger } from '../logger';
/**
 * Gitea API client
 */
export declare class GiteaAPI implements PlatformAPI {
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
}
//# sourceMappingURL=gitea.d.ts.map