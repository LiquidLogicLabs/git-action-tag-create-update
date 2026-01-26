"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiteaAPI = void 0;
exports.detectFromUrlByHostname = detectFromUrlByHostname;
exports.determineBaseUrl = determineBaseUrl;
exports.detectFromUrl = detectFromUrl;
const http_client_1 = require("./http-client");
function normalizeGiteaBaseUrl(baseUrl) {
    const trimmed = baseUrl.replace(/\/+$/, '');
    // If already points to an api path, keep it. Otherwise, append /api/v1.
    if (trimmed.match(/\/api\/v\d+$/)) {
        return trimmed;
    }
    return `${trimmed}/api/v1`;
}
/**
 * Gitea API client
 */
class GiteaAPI {
    client;
    repoInfo;
    logger;
    constructor(repoInfo, config, logger) {
        const baseUrl = normalizeGiteaBaseUrl(config.baseUrl || 'https://gitea.com/api/v1');
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
            this.logger.debug(`Gitea tag ${tagName} exists`);
            return true;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('404')) {
                this.logger.debug(`Gitea tag ${tagName} does not exist (404)`);
                return false;
            }
            this.logger.debug(`Gitea tagExists error for ${tagName}: ${error}`);
            throw error;
        }
    }
    /**
     * Create a tag
     */
    async createTag(options) {
        const { tagName, sha, message } = options;
        this.logger.info(`Creating Gitea tag: ${tagName} at ${sha}`);
        // Debug logging for message
        if (options.verbose) {
            this.logger.debug(`Tag message: ${message === undefined ? 'undefined' : `length=${message.length}, value="${message.substring(0, 50).replace(/\n/g, '\\n')}${message.length > 50 ? '...' : ''}"`}`);
            // Additional verbose trace to help diagnose API behaviors in self-hosted Gitea
            console.log(`[GiteaAPI] createTag debug: force=${options.force}, tag=${tagName}`);
        }
        // Check if tag exists
        const existsOriginal = await this.tagExists(tagName);
        const updateRequested = !!options.force;
        if (existsOriginal && !updateRequested) {
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
        if (existsOriginal && updateRequested) {
            await this.deleteTag(tagName);
        }
        // Attempt primary Gitea tag creation endpoint
        const createTagPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/tags`;
        const tagData = {
            tag_name: tagName,
            target: sha,
            message: message || `Tag ${tagName}`
        };
        const tryCreateViaRefs = async () => {
            // Fallback: create a lightweight tag ref (works on older / stricter Gitea)
            const refPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs`;
            const payload = {
                ref: `refs/tags/${tagName}`,
                sha
            };
            this.logger.warning(`Primary Gitea tag create failed; falling back to refs API for ${tagName}`);
            await this.client.post(refPath, payload);
        };
        try {
            await this.client.post(createTagPath, tagData);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message.toLowerCase() : '';
            // If the tag already exists and force is enabled, delete and retry
            if (msg.includes('409') && msg.includes('tag already exists')) {
                if (updateRequested) {
                    // Force update: delete and retry
                    this.logger.info(`Tag ${tagName} exists but force is enabled, deleting and recreating`);
                    await this.deleteTag(tagName);
                    // Retry creation
                    try {
                        await this.client.post(createTagPath, tagData);
                    }
                    catch (retryError) {
                        // If retry also fails with 405/404, try fallback
                        const retryMsg = retryError instanceof Error ? retryError.message.toLowerCase() : '';
                        if (retryMsg.includes('405') || retryMsg.includes('404')) {
                            await tryCreateViaRefs();
                        }
                        else {
                            throw retryError;
                        }
                    }
                }
                else {
                    // No force: surface a graceful result
                    this.logger.warning(`Tag ${tagName} already exists (detected during create)`);
                    return {
                        tagName,
                        sha,
                        exists: true,
                        created: false,
                        updated: false
                    };
                }
            }
            else {
                // Fallback to refs API on method/endpoint errors (405/404)
                if (msg.includes('405') || msg.includes('404')) {
                    await tryCreateViaRefs();
                }
                else {
                    throw error;
                }
            }
        }
        this.logger.info(`Tag created successfully: ${tagName}`);
        return {
            tagName,
            sha,
            exists: existsOriginal || updateRequested,
            created: !existsOriginal,
            updated: updateRequested
        };
    }
    /**
     * Update a tag (delete and recreate)
     */
    async updateTag(options) {
        await this.deleteTag(options.tagName);
        return this.createTag({ ...options, force: true });
    }
    /**
     * Delete a tag
     */
    async deleteTag(tagName) {
        this.logger.info(`Deleting Gitea tag: ${tagName}`);
        // Delete the ref
        const path = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs/tags/${tagName}`;
        try {
            await this.client.delete(path);
        }
        catch (error) {
            if (error instanceof Error && (error.message.includes('404') || error.message.includes('405'))) {
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
        // Gitea API returns an array for /git/refs/heads/ endpoint
        const refPath = `/repos/${this.repoInfo.owner}/${this.repoInfo.repo}/git/refs/heads/${defaultBranch}`;
        const refInfoArray = await this.client.get(refPath);
        if (refInfoArray.length === 0) {
            throw new Error(`No ref found for branch ${defaultBranch}`);
        }
        return refInfoArray[0].object.sha;
    }
}
exports.GiteaAPI = GiteaAPI;
function detectFromUrlByHostname(url) {
    const hostname = url.hostname.toLowerCase();
    if (hostname.includes('gitea.com') || hostname.includes('gitea')) {
        return 'gitea';
    }
    return undefined;
}
function determineBaseUrl(urls) {
    const urlArray = Array.isArray(urls) ? urls : [urls];
    // Check if first URL is an explicit API URL (contains /api)
    if (urlArray.length > 0 && urlArray[0]) {
        try {
            const url = new URL(urlArray[0]);
            if (url.pathname.includes('/api')) {
                return urlArray[0];
            }
        }
        catch {
            // Not a valid URL, continue
        }
    }
    // Check repository/origin URLs to derive API URL
    for (const urlStr of urlArray) {
        if (!urlStr)
            continue;
        try {
            const url = new URL(urlStr);
            const baseUrl = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}/api/v1`;
            return baseUrl;
        }
        catch {
            // Not a valid URL, skip
        }
    }
    // Check environment variables
    const serverUrl = process.env.GITHUB_SERVER_URL || process.env.GITEA_SERVER_URL || process.env.GITEA_API_URL;
    if (serverUrl) {
        return `${serverUrl.replace(/\/$/, '')}/api/v1`;
    }
    // Default Gitea API URL
    return 'https://gitea.com/api/v1';
}
async function headOk(url, logger) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    try {
        const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok || response.status === 401 || response.status === 403) {
            logger.debug(`Gitea detect: ${url} status ${response.status}`);
            return true;
        }
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            logger.debug(`Gitea detect timeout: ${url}`);
        }
    }
    return false;
}
async function detectFromUrl(url, logger) {
    const base = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
    const paths = ['/api/v1/version'];
    for (const path of paths) {
        if (await headOk(`${base}${path}`, logger)) {
            return 'gitea';
        }
    }
    return undefined;
}
//# sourceMappingURL=gitea.js.map