"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitbucketAPI = void 0;
exports.detectFromUrlByHostname = detectFromUrlByHostname;
exports.detectFromUrl = detectFromUrl;
exports.determineBaseUrl = determineBaseUrl;
const http_client_1 = require("./http-client");
/**
 * Bitbucket API client
 */
class BitbucketAPI {
    client;
    repoInfo;
    logger;
    constructor(repoInfo, config, logger) {
        // Bitbucket uses different API versions for cloud vs server
        // Cloud: https://api.bitbucket.org/2.0
        // Server: https://<server>/rest/api/1.0
        const baseUrl = config.baseUrl || 'https://api.bitbucket.org/2.0';
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
            const path = `/repositories/${this.repoInfo.owner}/${this.repoInfo.repo}/refs/tags/${tagName}`;
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
        this.logger.info(`Creating Bitbucket tag: ${tagName} at ${sha}`);
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
        // Create tag via Bitbucket API
        const path = `/repositories/${this.repoInfo.owner}/${this.repoInfo.repo}/refs/tags`;
        const tagData = {
            name: tagName,
            target: {
                hash: sha
            },
            message: message || `Tag ${tagName}`
        };
        try {
            await this.client.post(path, tagData);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message.toLowerCase() : '';
            // If the tag already exists and force is enabled, delete and retry
            if ((msg.includes('409') || msg.includes('422') || msg.includes('already exists')) && options.force) {
                this.logger.info(`Tag ${tagName} exists but force is enabled, deleting and recreating`);
                await this.deleteTag(tagName);
                // Retry creation
                await this.client.post(path, tagData);
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
        this.logger.info(`Deleting Bitbucket tag: ${tagName}`);
        const path = `/repositories/${this.repoInfo.owner}/${this.repoInfo.repo}/refs/tags/${tagName}`;
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
        const repoPath = `/repositories/${this.repoInfo.owner}/${this.repoInfo.repo}`;
        const repoInfo = await this.client.get(repoPath);
        const defaultBranch = repoInfo.mainbranch?.name || 'main';
        // Get the HEAD SHA from the default branch
        const refPath = `/repositories/${this.repoInfo.owner}/${this.repoInfo.repo}/refs/branches/${defaultBranch}`;
        const refInfo = await this.client.get(refPath);
        return refInfo.target.hash;
    }
}
exports.BitbucketAPI = BitbucketAPI;
function detectFromUrlByHostname(url) {
    const hostname = url.hostname.toLowerCase();
    if (hostname.includes('bitbucket.org') || hostname.includes('bitbucket')) {
        return 'bitbucket';
    }
    return undefined;
}
async function headOk(url, logger) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    try {
        const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok || response.status === 401 || response.status === 403) {
            logger.debug(`Bitbucket detect: ${url} status ${response.status}`);
            return true;
        }
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            logger.debug(`Bitbucket detect timeout: ${url}`);
        }
    }
    return false;
}
async function detectFromUrl(url, logger) {
    const base = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
    const paths = ['/rest/api/1.0', '/2.0'];
    for (const path of paths) {
        if (await headOk(`${base}${path}`, logger)) {
            return 'bitbucket';
        }
    }
    return undefined;
}
function determineBaseUrl(_urls) {
    // Bitbucket uses fixed API URLs
    return 'https://api.bitbucket.org/2.0';
}
//# sourceMappingURL=bitbucket.js.map