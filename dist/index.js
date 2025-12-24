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
const core = __importStar(require("@actions/core"));
const config_1 = require("./config");
const logger_1 = require("./logger");
const platform_detector_1 = require("./platform-detector");
const git_1 = require("./git");
const github_1 = require("./platforms/github");
const gitea_1 = require("./platforms/gitea");
const bitbucket_1 = require("./platforms/bitbucket");
const generic_1 = require("./platforms/generic");
/**
 * Create platform API instance
 */
function createPlatformAPI(repoType, repoInfo, config, logger) {
    const platformConfig = {
        type: repoType,
        baseUrl: config.baseUrl,
        token: config.token,
        ignoreCertErrors: config.ignoreCertErrors,
        verbose: config.verbose,
        pushTag: config.pushTag
    };
    switch (repoType) {
        case 'github':
            return new github_1.GitHubAPI(repoInfo, platformConfig, logger);
        case 'gitea':
            return new gitea_1.GiteaAPI(repoInfo, platformConfig, logger);
        case 'bitbucket':
            return new bitbucket_1.BitbucketAPI(repoInfo, platformConfig, logger);
        case 'generic':
        default:
            return new generic_1.GenericGitAPI(repoInfo, platformConfig, logger);
    }
}
/**
 * Main action function
 */
async function run() {
    try {
        // Get and validate inputs
        const inputs = (0, config_1.getInputs)();
        const logger = new logger_1.Logger(inputs.verbose);
        logger.info(`Creating/updating tag: ${inputs.tagName}`);
        // Get repository information
        const repoInfo = await (0, platform_detector_1.getRepositoryInfo)(inputs.repository, inputs.repoType, logger);
        // Determine if we should use local Git or platform API
        const useLocalGit = await (0, git_1.isGitRepository)(logger);
        const usePlatformAPI = !useLocalGit || repoInfo.platform !== 'generic';
        logger.debug(`Use local Git: ${useLocalGit}, Use platform API: ${usePlatformAPI}`);
        // Get SHA to tag
        let sha = inputs.tagSha;
        if (!sha) {
            if (useLocalGit) {
                sha = await (0, git_1.getHeadSha)(logger);
            }
            else {
                throw new Error('tag_sha is required when not running in a local Git repository');
            }
        }
        // Prepare tag options
        const tagOptions = {
            tagName: inputs.tagName,
            sha,
            message: inputs.tagMessage,
            gpgSign: inputs.gpgSign,
            gpgKeyId: inputs.gpgKeyId,
            force: inputs.force,
            verbose: inputs.verbose
        };
        let result;
        if (useLocalGit && !usePlatformAPI) {
            // Use local Git CLI directly
            logger.info('Using local Git CLI');
            result = await (0, git_1.createTag)(tagOptions, logger);
            // Push to remote if push_tag is enabled and we have a remote configured
            if (inputs.pushTag && repoInfo.url) {
                try {
                    logger.info(`Pushing tag ${inputs.tagName} to remote`);
                    await (0, git_1.pushTag)(inputs.tagName, 'origin', inputs.token, inputs.force, logger);
                    logger.info(`Tag ${inputs.tagName} pushed successfully`);
                }
                catch (error) {
                    logger.warning(`Failed to push tag: ${error}`);
                }
            }
            else if (!inputs.pushTag) {
                logger.debug('push_tag is false, skipping tag push');
            }
        }
        else {
            // Use platform API
            logger.info(`Using ${repoInfo.platform} API`);
            // Determine base URL for platform
            let baseUrl = inputs.baseUrl;
            if (!baseUrl) {
                switch (repoInfo.platform) {
                    case 'github':
                        baseUrl = 'https://api.github.com';
                        break;
                    case 'gitea':
                        baseUrl = 'https://gitea.com/api/v1';
                        break;
                    case 'bitbucket':
                        baseUrl = 'https://api.bitbucket.org/2.0';
                        break;
                }
            }
            const platformAPI = createPlatformAPI(repoInfo.platform, repoInfo, {
                token: inputs.token,
                baseUrl,
                ignoreCertErrors: inputs.ignoreCertErrors,
                verbose: inputs.verbose,
                pushTag: inputs.pushTag
            }, logger);
            // Check if tag exists
            const exists = await platformAPI.tagExists(inputs.tagName);
            if (exists && !inputs.updateExisting) {
                // Tag exists and we're not updating
                logger.info(`Tag ${inputs.tagName} already exists`);
                result = {
                    tagName: inputs.tagName,
                    sha,
                    exists: true,
                    created: false,
                    updated: false
                };
            }
            else if (exists && inputs.updateExisting) {
                // Tag exists and we should update it
                logger.info(`Updating existing tag: ${inputs.tagName}`);
                result = await platformAPI.updateTag(tagOptions);
            }
            else {
                // Tag doesn't exist, create it
                logger.info(`Creating new tag: ${inputs.tagName}`);
                result = await platformAPI.createTag(tagOptions);
            }
        }
        // Set outputs
        core.setOutput('tag_name', result.tagName);
        core.setOutput('tag_sha', result.sha);
        core.setOutput('tag_exists', result.exists.toString());
        core.setOutput('tag_updated', result.updated.toString());
        core.setOutput('tag_created', result.created.toString());
        core.setOutput('platform', repoInfo.platform);
        logger.info('Action completed successfully');
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed('Unknown error occurred');
        }
    }
}
// Run the action
run();
//# sourceMappingURL=index.js.map