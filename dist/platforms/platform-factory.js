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
exports.createPlatformAPI = createPlatformAPI;
const exec = __importStar(require("@actions/exec"));
const git_platform_detector_1 = require("git-platform-detector");
const github_1 = require("./github");
const gitea_1 = require("./gitea");
const bitbucket_1 = require("./bitbucket");
const generic_1 = require("./generic");
const platformProviders = [
    {
        type: 'gitea',
        createAPI: (repoInfo, config, logger) => new gitea_1.GiteaAPI(repoInfo, config, logger)
    },
    {
        type: 'github',
        createAPI: (repoInfo, config, logger) => new github_1.GitHubAPI(repoInfo, config, logger)
    },
    {
        type: 'bitbucket',
        createAPI: (repoInfo, config, logger) => new bitbucket_1.BitbucketAPI(repoInfo, config, logger)
    },
    {
        type: 'generic',
        createAPI: (repoInfo, config, logger) => new generic_1.GenericGitAPI(repoInfo, config, logger)
    }
];
/**
 * Collect candidate URLs from repository URL, origin URL, and environment variables
 */
async function collectCandidateUrls(repoInfo, logger) {
    const urls = [];
    // Add repository URL if available
    if (repoInfo.url) {
        urls.push(repoInfo.url);
    }
    // Try to get origin URL from git
    try {
        const output = [];
        await exec.exec('git', ['config', '--get', 'remote.origin.url'], {
            silent: true,
            listeners: {
                stdout: (data) => {
                    output.push(data.toString());
                }
            },
            ignoreReturnCode: true
        });
        const originUrl = output.join('').trim();
        if (originUrl && originUrl !== repoInfo.url) {
            urls.push(originUrl);
            logger.debug(`Added origin URL: ${originUrl}`);
        }
    }
    catch {
        // Git not available or no origin - skip
    }
    // Add environment variable URLs
    const envUrls = [
        process.env.GITHUB_SERVER_URL,
        process.env.GITEA_SERVER_URL,
        process.env.GITEA_API_URL
    ].filter((url) => !!url);
    for (const envUrl of envUrls) {
        if (!urls.includes(envUrl)) {
            urls.push(envUrl);
            logger.debug(`Added environment URL: ${envUrl}`);
        }
    }
    return urls;
}
async function resolvePlatform(repoInfo, repoType, logger, token) {
    if (repoType !== 'auto') {
        // git-platform-detector now supports 'git' and 'local' as aliases for 'generic'
        (0, git_platform_detector_1.createByName)(repoType, { providers: (0, git_platform_detector_1.getBuiltInProviders)() });
        // Return 'generic' for 'git' to maintain consistency with internal provider types
        return repoType === 'git' ? 'generic' : repoType;
    }
    if (repoInfo.platform !== 'auto') {
        // git-platform-detector now supports 'git' and 'local' as aliases for 'generic'
        (0, git_platform_detector_1.createByName)(repoInfo.platform, { providers: (0, git_platform_detector_1.getBuiltInProviders)() });
        // Return 'generic' for 'git' to maintain consistency with internal provider types
        return repoInfo.platform === 'git' ? 'generic' : repoInfo.platform;
    }
    // Collect candidate URLs
    const candidateUrls = await collectCandidateUrls(repoInfo, logger);
    const detection = await (0, git_platform_detector_1.detectPlatform)({
        providers: (0, git_platform_detector_1.getBuiltInProviders)(),
        extraUrls: candidateUrls,
        env: {},
        credentials: token ? { token } : undefined
    });
    switch (detection.providerId) {
        case 'github':
            logger.debug('Detected platform github via shared detector');
            return 'github';
        case 'gitea':
            logger.debug('Detected platform gitea via shared detector');
            return 'gitea';
        case 'bitbucket':
            logger.debug('Detected platform bitbucket via shared detector');
            return 'bitbucket';
        case 'generic':
            logger.debug('Detected platform generic via shared detector');
            return 'generic';
        default:
            logger.debug(`Unknown platform ${detection.providerId}, defaulting to generic`);
            return 'generic';
    }
}
async function createPlatformAPI(repoInfo, repoType, config, logger) {
    const platform = await resolvePlatform(repoInfo, repoType, logger, config.token);
    // Find the provider for the resolved platform
    const provider = platformProviders.find(p => p.type === platform) || platformProviders.find(p => p.type === 'generic');
    // Collect candidate URLs for base URL determination
    const candidateUrls = await collectCandidateUrls(repoInfo, logger);
    // If explicit baseUrl is provided, prepend it to the array
    const urlsForBaseUrl = config.baseUrl ? [config.baseUrl, ...candidateUrls] : candidateUrls;
    // Determine base URL using the platform's internal function (not part of interface)
    let determineBaseUrlFn;
    switch (platform) {
        case 'github':
            determineBaseUrlFn = github_1.determineBaseUrl;
            break;
        case 'gitea':
            determineBaseUrlFn = gitea_1.determineBaseUrl;
            break;
        case 'bitbucket':
            determineBaseUrlFn = bitbucket_1.determineBaseUrl;
            break;
        default:
            determineBaseUrlFn = generic_1.determineBaseUrl;
            break;
    }
    const baseUrl = determineBaseUrlFn(urlsForBaseUrl);
    const platformConfig = {
        type: platform,
        baseUrl,
        token: config.token,
        ignoreCertErrors: config.ignoreCertErrors,
        verbose: config.verbose,
        pushTag: config.pushTag
    };
    const api = provider.createAPI(repoInfo, platformConfig, logger);
    return { platform, api, baseUrl };
}
//# sourceMappingURL=platform-factory.js.map