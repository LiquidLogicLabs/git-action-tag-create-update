"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRepository = parseRepository;
exports.getLocalRepositoryInfo = getLocalRepositoryInfo;
exports.detectPlatform = detectPlatform;
exports.getRepositoryInfo = getRepositoryInfo;
const exec = __importStar(require("@actions/exec"));
const io = __importStar(require("@actions/io"));
/**
 * Detect platform from known public URLs
 */
function detectPlatformFromHostname(hostname) {
    const lowerHostname = hostname.toLowerCase();
    if (lowerHostname.includes('github.com')) {
        return 'github';
    }
    if (lowerHostname.includes('gitea.com')) {
        return 'gitea';
    }
    if (lowerHostname.includes('bitbucket.org')) {
        return 'bitbucket';
    }
    return undefined;
}
/**
 * Query URL to detect platform by checking common API endpoints
 */
async function detectPlatformFromUrl(url, logger) {
    const protocol = url.protocol;
    const hostname = url.hostname;
    const port = url.port ? `:${url.port}` : '';
    const baseUrl = `${protocol}//${hostname}${port}`;
    // Try common API endpoints
    const endpoints = [
        { path: '/api/v1/version', platform: 'gitea' },
        { path: '/api/v3', platform: 'github' },
        { path: '/api', platform: 'github' },
        { path: '/rest/api/1.0', platform: 'bitbucket' },
        { path: '/2.0', platform: 'bitbucket' }
    ];
    for (const endpoint of endpoints) {
        try {
            const testUrl = `${baseUrl}${endpoint.path}`;
            logger.debug(`Trying to detect platform from ${testUrl}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
            try {
                const response = await fetch(testUrl, {
                    method: 'HEAD',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (response.ok || response.status === 401 || response.status === 403) {
                    // 401/403 means the endpoint exists but requires auth - that's good enough
                    logger.debug(`Detected platform ${endpoint.platform} from ${testUrl} (status: ${response.status})`);
                    return endpoint.platform;
                }
            }
            catch (error) {
                clearTimeout(timeoutId);
                // Continue to next endpoint
                if (error instanceof Error && error.name === 'AbortError') {
                    logger.debug(`Timeout detecting platform from ${testUrl}`);
                }
            }
        }
        catch (error) {
            // Continue to next endpoint
            logger.debug(`Error detecting platform: ${error}`);
        }
    }
    return undefined;
}
/**
 * Parse repository URL or owner/repo format
 */
function parseRepository(repository, logger) {
    if (!repository) {
        return undefined;
    }
    logger.debug(`Parsing repository: ${repository}`);
    // Try to parse as URL first
    try {
        const url = new URL(repository);
        const hostname = url.hostname.toLowerCase();
        // Extract owner/repo from path
        const pathParts = url.pathname.split('/').filter(p => p);
        if (pathParts.length >= 2) {
            const owner = pathParts[0];
            const repo = pathParts[1].replace(/\.git$/, '');
            // First, check known public URLs
            const platform = detectPlatformFromHostname(hostname) || 'auto';
            logger.debug(`Detected platform: ${platform} from URL: ${url.href}`);
            return {
                owner,
                repo,
                url: url.href,
                platform
            };
        }
    }
    catch {
        // Not a URL, try owner/repo format
    }
    // Try owner/repo format (e.g., "owner/repo")
    const parts = repository.split('/');
    if (parts.length === 2) {
        logger.debug(`Parsed as owner/repo format: ${parts[0]}/${parts[1]}`);
        return {
            owner: parts[0],
            repo: parts[1],
            platform: 'auto' // Will be detected later
        };
    }
    logger.warning(`Could not parse repository format: ${repository}`);
    return undefined;
}
/**
 * Get repository info from local Git repository
 */
async function getLocalRepositoryInfo(logger) {
    const gitPath = await io.which('git', true);
    if (!gitPath) {
        logger.debug('Git not found in PATH');
        return undefined;
    }
    // Check if we're in a Git repository
    try {
        const exitCode = await exec.exec('git', ['rev-parse', '--git-dir'], {
            silent: true,
            ignoreReturnCode: true
        });
        if (exitCode !== 0) {
            logger.debug('Not in a Git repository');
            return undefined;
        }
        // Get remote URL - if no remote origin, assume local git (generic)
        let remoteUrl = '';
        try {
            const output = [];
            await exec.exec('git', ['config', '--get', 'remote.origin.url'], {
                silent: true,
                listeners: {
                    stdout: (data) => {
                        output.push(data.toString());
                    }
                }
            });
            remoteUrl = output.join('').trim();
        }
        catch {
            logger.debug('No remote origin found, will use local git (generic)');
            // No remote origin - return undefined so caller can use generic
            return undefined;
        }
        // If we have a remote URL, parse it
        if (remoteUrl) {
            const parsed = parseRepository(remoteUrl, logger);
            if (parsed) {
                return parsed;
            }
        }
        logger.debug('Could not determine repository info from local Git repo');
        return undefined;
    }
    catch (error) {
        logger.debug(`Error checking local repository: ${error}`);
        return undefined;
    }
}
/**
 * Detect platform from repository info or explicit repo type
 */
function detectPlatform(repoType, repositoryInfo, logger) {
    // If explicit type is provided and not 'auto', use it
    if (repoType !== 'auto') {
        logger.debug(`Using explicit repo_type: ${repoType}`);
        return repoType;
    }
    // If we have repository info with a detected platform, use it
    if (repositoryInfo && repositoryInfo.platform !== 'auto') {
        logger.debug(`Detected platform from repository: ${repositoryInfo.platform}`);
        return repositoryInfo.platform;
    }
    // Fallback to generic (local git)
    logger.debug('Could not detect platform, using generic');
    return 'generic';
}
/**
 * Get full repository information
 */
async function getRepositoryInfo(repository, repoType, logger) {
    let repoInfo;
    // Try to parse provided repository
    if (repository) {
        repoInfo = parseRepository(repository, logger);
        // If platform is 'auto' and we have a URL, try to query it to detect platform
        if (repoInfo && repoInfo.platform === 'auto' && repoInfo.url) {
            try {
                const url = new URL(repoInfo.url);
                const detectedPlatform = await detectPlatformFromUrl(url, logger);
                if (detectedPlatform) {
                    repoInfo.platform = detectedPlatform;
                    logger.debug(`Detected platform ${detectedPlatform} by querying URL`);
                }
            }
            catch (error) {
                logger.debug(`Could not query URL to detect platform: ${error}`);
            }
        }
    }
    // If not provided or couldn't parse, try local repository
    if (!repoInfo) {
        repoInfo = await getLocalRepositoryInfo(logger);
        // If we got repo info with auto platform and have a URL, try to query it
        if (repoInfo && repoInfo.platform === 'auto' && repoInfo.url) {
            try {
                const url = new URL(repoInfo.url);
                const detectedPlatform = await detectPlatformFromUrl(url, logger);
                if (detectedPlatform) {
                    repoInfo.platform = detectedPlatform;
                    logger.debug(`Detected platform ${detectedPlatform} by querying URL`);
                }
            }
            catch (error) {
                logger.debug(`Could not query URL to detect platform: ${error}`);
            }
        }
    }
    // If still no info, try environment variables as fallback
    if (!repoInfo) {
        // Check Gitea first (since Gitea Actions sets GITHUB_REPOSITORY for compatibility)
        const giteaRepo = process.env.GITEA_REPOSITORY;
        const giteaServerUrl = process.env.GITEA_SERVER_URL || process.env.GITEA_API_URL;
        const githubServerUrl = process.env.GITHUB_SERVER_URL;
        if (giteaRepo) {
            const [owner, repo] = giteaRepo.split('/');
            repoInfo = {
                owner,
                repo,
                platform: 'gitea'
            };
            logger.debug(`Using GITEA_REPOSITORY: ${owner}/${repo}`);
        }
        else if (giteaServerUrl || (githubServerUrl && !githubServerUrl.includes('github.com'))) {
            // Gitea server URL or GITHUB_SERVER_URL set to non-GitHub URL indicates Gitea
            const githubRepo = process.env.GITHUB_REPOSITORY;
            if (githubRepo) {
                const [owner, repo] = githubRepo.split('/');
                repoInfo = {
                    owner,
                    repo,
                    platform: 'gitea'
                };
                logger.debug(`Detected Gitea from server URL: ${owner}/${repo}`);
            }
        }
        else if (process.env.GITHUB_REPOSITORY) {
            const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
            repoInfo = {
                owner,
                repo,
                platform: 'github'
            };
            logger.debug(`Using GITHUB_REPOSITORY: ${owner}/${repo}`);
        }
    }
    // If we still don't have info, throw error
    if (!repoInfo) {
        throw new Error('Could not determine repository information. Please provide repository input or run in a Git repository.');
    }
    // Detect platform (this will use the platform from repoInfo if set, or fallback to generic)
    const platform = detectPlatform(repoType, repoInfo, logger);
    repoInfo.platform = platform;
    logger.info(`Repository: ${repoInfo.owner}/${repoInfo.repo}, Platform: ${platform}`);
    return repoInfo;
}
//# sourceMappingURL=platform-detector.js.map