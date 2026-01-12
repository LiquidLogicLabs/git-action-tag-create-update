"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubAPI = void 0;
const http_client_1 = require("./http-client");
/**
 * GitHub API client
 */
class GitHubAPI {
    client;
    repoInfo;
    logger;
    constructor(repoInfo, config, logger) {
        const baseUrl = config.baseUrl || 'https://api.github.com';
        this.client = new http_client_1.HttpClient({
            baseUrl,
            token: config.token,
            ignoreCertErrors: config.ignoreCertErrors,
            verbose: config.verbose
        }, logger);
        this.repoInfo = repoInfo;
        this.logger = logger;
    }
    /**
     * Check if a tag exists
     */
    async tagExists(tagName) {
        try {
            const path = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs/tags/${tagName}`;
            await this.client.get(path);
            return true;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('404')) {
                return false;
            }
            throw error;
        }
    }
    /**
     * Create a tag
     */
    async createTag(options) {
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
        const tagResponse = await this.client.post(path, tagObject);
        // Create ref pointing to the tag
        const refPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs`;
        try {
            await this.client.post(refPath, {
                ref: `refs/tags/${tagName}`,
                sha: tagResponse.sha
            });
        }
        catch (error) {
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
            }
            else {
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
    async updateTag(options) {
        await this.deleteTag(options.tagName);
        return this.createTag(options);
    }
    /**
     * Delete a tag
     */
    async deleteTag(tagName) {
        this.logger.info(`Deleting GitHub tag: ${tagName}`);
        const path = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs/tags/${tagName}`;
        try {
            await this.client.delete(path);
        }
        catch (error) {
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
    async getHeadSha() {
        // Get repository info to find default branch
        const repoPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}`;
        const repoInfo = await this.client.get(repoPath);
        const defaultBranch = repoInfo.default_branch || 'main';
        // Get the HEAD SHA from the default branch
        const refPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/ref/heads/${defaultBranch}`;
        const refInfo = await this.client.get(refPath);
        return refInfo.object.sha;
    }
}
exports.GitHubAPI = GitHubAPI;
//# sourceMappingURL=github.js.map