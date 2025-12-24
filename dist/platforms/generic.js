"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericGitAPI = void 0;
const git_1 = require("../git");
/**
 * Generic Git CLI platform implementation
 * Uses Git CLI for all operations
 */
class GenericGitAPI {
    repoInfo;
    config;
    logger;
    constructor(repoInfo, config, logger) {
        this.repoInfo = repoInfo;
        this.config = config;
        this.logger = logger;
    }
    /**
     * Check if a tag exists
     */
    async tagExists(tagName) {
        return (0, git_1.tagExistsLocally)(tagName, this.logger);
    }
    /**
     * Create a tag
     */
    async createTag(options) {
        this.logger.info(`Creating tag using Git CLI: ${options.tagName}`);
        // Get SHA if not provided
        let sha = options.sha;
        if (!sha) {
            sha = await (0, git_1.getHeadSha)(this.logger);
        }
        // Create tag locally
        const result = await (0, git_1.createTag)({
            ...options,
            sha
        }, this.logger);
        // Push to remote if pushTag is enabled and we have repository info
        if (this.config.pushTag !== false && this.repoInfo.url) {
            try {
                this.logger.info(`Pushing tag ${options.tagName} to remote`);
                await (0, git_1.pushTag)(options.tagName, 'origin', this.config.token, options.force, this.logger);
                this.logger.info(`Tag ${options.tagName} pushed successfully`);
            }
            catch (error) {
                this.logger.warning(`Failed to push tag to remote: ${error}`);
                // Continue anyway - tag was created locally
            }
        }
        else if (this.config.pushTag === false) {
            this.logger.debug('push_tag is false, skipping tag push');
        }
        return result;
    }
    /**
     * Update a tag (delete and recreate)
     */
    async updateTag(options) {
        this.logger.info(`Updating tag using Git CLI: ${options.tagName}`);
        // Delete from remote first if exists
        if (this.repoInfo.url) {
            try {
                await (0, git_1.deleteTagRemote)(options.tagName, 'origin', this.config.token, this.logger);
            }
            catch (error) {
                this.logger.debug(`Tag may not exist remotely: ${error}`);
            }
        }
        // Create new tag (which will overwrite local if force is enabled)
        return this.createTag(options);
    }
    /**
     * Delete a tag
     */
    async deleteTag(tagName) {
        this.logger.info(`Deleting tag using Git CLI: ${tagName}`);
        // Delete from remote if we have repository info
        if (this.repoInfo.url) {
            try {
                await (0, git_1.deleteTagRemote)(tagName, 'origin', this.config.token, this.logger);
            }
            catch (error) {
                this.logger.debug(`Tag may not exist remotely: ${error}`);
            }
        }
        // Delete locally
        await (0, git_1.deleteTagLocally)(tagName, this.logger);
    }
}
exports.GenericGitAPI = GenericGitAPI;
//# sourceMappingURL=generic.js.map