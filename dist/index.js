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
exports.run = run;
const core = __importStar(require("@actions/core"));
const config_1 = require("./config");
const logger_1 = require("./logger");
const repo_utils_1 = require("./repo-utils");
const git_1 = require("./git");
const platform_factory_1 = require("./platforms/platform-factory");
/**
 * Main action function
 */
async function run() {
    try {
        // Get and validate inputs
        const inputs = (0, config_1.getInputs)();
        const logger = new logger_1.Logger(inputs.verbose);
        logger.info(`Creating/updating tag: ${inputs.tagName}`);
        // Log all inputs when verbose is enabled
        if (inputs.verbose) {
            logger.debug('=== INPUTS ===');
            logger.debug(`tag_name: ${inputs.tagName}`);
            logger.debug(`tag_sha: ${inputs.tagSha || 'undefined (will use HEAD)'}`);
            if (inputs.tagMessage === undefined) {
                logger.debug(`tag_message: undefined (will create lightweight tag)`);
            }
            else {
                const msgLength = inputs.tagMessage.length;
                const msgPreview = inputs.tagMessage.length > 100
                    ? inputs.tagMessage.substring(0, 100) + '...'
                    : inputs.tagMessage;
                logger.debug(`tag_message: length=${msgLength}, preview="${msgPreview.replace(/\n/g, '\\n')}"`);
            }
            logger.debug(`repository: ${inputs.repository || 'undefined (will use current repo)'}`);
            logger.debug(`token: ${inputs.token ? '*** (explicitly provided)' : 'undefined (will resolve from env based on platform)'}`);
            logger.debug(`repo_type: ${inputs.repoType}`);
            logger.debug(`base_url: ${inputs.baseUrl || 'undefined (will auto-detect)'}`);
            logger.debug(`update_existing: ${inputs.updateExisting}`);
            logger.debug(`gpg_sign: ${inputs.gpgSign}`);
            logger.debug(`gpg_key_id: ${inputs.gpgKeyId || 'undefined'}`);
            logger.debug(`ignore_cert_errors: ${inputs.ignoreCertErrors}`);
            logger.debug(`force: ${inputs.force}`);
            logger.debug(`push_tag: ${inputs.pushTag}`);
            logger.debug(`git_user_name: ${inputs.gitUserName || 'undefined (will auto-detect)'}`);
            logger.debug(`git_user_email: ${inputs.gitUserEmail || 'undefined (will auto-detect)'}`);
            logger.debug(`verbose: ${inputs.verbose}`);
        }
        // Get repository information
        const repoInfo = await (0, repo_utils_1.getRepositoryInfo)(inputs.repository, inputs.repoType, logger);
        // Resolve token based on detected platform
        const resolvedToken = (0, config_1.resolveToken)(inputs.token, repoInfo.platform);
        // Determine if we should use local Git or platform API
        // For github, gitea, and bitbucket platforms, always use the platform API
        // For generic and git platforms, use local Git CLI
        const useLocalGit = await (0, git_1.isGitRepository)(logger);
        const usePlatformAPI = !useLocalGit || (repoInfo.platform !== 'generic' && repoInfo.platform !== 'git');
        if (inputs.verbose) {
            logger.debug('=== REPOSITORY INFO ===');
            logger.debug(`owner: ${repoInfo.owner}`);
            logger.debug(`repo: ${repoInfo.repo}`);
            logger.debug(`platform: ${repoInfo.platform}`);
            logger.debug(`url: ${repoInfo.url || 'undefined'}`);
            logger.debug(`useLocalGit: ${useLocalGit}`);
            logger.debug(`usePlatformAPI: ${usePlatformAPI}`);
            logger.debug(`token: ${resolvedToken ? '*** (resolved from env)' : 'undefined'}`);
        }
        else {
            logger.debug(`Use local Git: ${useLocalGit}, Use platform API: ${usePlatformAPI}`);
        }
        // Get SHA to tag
        let sha = inputs.tagSha;
        if (!sha) {
            if (usePlatformAPI) {
                // When using platform API, get HEAD SHA from the remote repository
                const { platform, api: platformAPI } = await (0, platform_factory_1.createPlatformAPI)(repoInfo, inputs.repoType, {
                    token: resolvedToken,
                    baseUrl: inputs.baseUrl,
                    ignoreCertErrors: inputs.ignoreCertErrors,
                    verbose: inputs.verbose,
                    pushTag: inputs.pushTag
                }, logger);
                repoInfo.platform = platform;
                sha = await platformAPI.getHeadSha();
                logger.debug(`Using HEAD SHA from remote repository: ${sha}`);
            }
            else if (useLocalGit) {
                sha = await (0, git_1.getHeadSha)(logger);
            }
            else {
                throw new Error('tag_sha is required when not running in a local Git repository and not using a platform API');
            }
        }
        if (!sha) {
            throw new Error('Failed to resolve tag SHA');
        }
        // Prepare tag options
        const tagOptions = {
            tagName: inputs.tagName,
            sha,
            message: inputs.tagMessage,
            gpgSign: inputs.gpgSign,
            gpgKeyId: inputs.gpgKeyId,
            force: inputs.force,
            verbose: inputs.verbose,
            gitUserName: inputs.gitUserName,
            gitUserEmail: inputs.gitUserEmail
        };
        // Log tag options when verbose is enabled
        if (inputs.verbose) {
            logger.debug('=== TAG OPTIONS ===');
            logger.debug(`tagName: ${tagOptions.tagName}`);
            logger.debug(`sha: ${sha}`);
            logger.debug(`message: ${tagOptions.message === undefined ? 'undefined (lightweight tag)' : `length=${tagOptions.message.length} (annotated tag)`}`);
            logger.debug(`gpgSign: ${tagOptions.gpgSign}`);
            logger.debug(`gpgKeyId: ${tagOptions.gpgKeyId || 'undefined'}`);
            logger.debug(`force: ${tagOptions.force}`);
            logger.debug(`gitUserName: ${tagOptions.gitUserName || 'undefined'}`);
            logger.debug(`gitUserEmail: ${tagOptions.gitUserEmail || 'undefined'}`);
        }
        let result;
        if (useLocalGit && !usePlatformAPI) {
            // Use local Git CLI directly
            logger.info('Using local Git CLI');
            result = await (0, git_1.createTag)(tagOptions, logger);
            // Push to remote if push_tag is enabled and we have a remote configured
            if (inputs.pushTag && repoInfo.url) {
                try {
                    logger.info(`Pushing tag ${inputs.tagName} to remote`);
                    await (0, git_1.pushTag)(inputs.tagName, 'origin', resolvedToken, inputs.force, logger);
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
            // Use platform API via factory (hostname-first, then per-platform detection)
            const { platform, api: platformAPI } = await (0, platform_factory_1.createPlatformAPI)(repoInfo, inputs.repoType, {
                token: resolvedToken,
                baseUrl: inputs.baseUrl,
                ignoreCertErrors: inputs.ignoreCertErrors,
                verbose: inputs.verbose,
                pushTag: inputs.pushTag
            }, logger);
            repoInfo.platform = platform;
            logger.info(`Using ${platform} API`);
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
                // Tag doesn't exist, create it (whether update_existing is true or false)
                logger.info(`Creating new tag: ${inputs.tagName}`);
                result = await platformAPI.createTag(tagOptions);
            }
        }
        // Set outputs
        if (inputs.updateExisting && result.updated !== true) {
            // In update mode, ensure outputs reflect an attempted update even if the platform response
            // did not mark it as such (e.g., legacy APIs that don't signal updates explicitly).
            result = { ...result, updated: true, exists: true };
        }
        core.setOutput('tag_name', result.tagName);
        core.setOutput('tag_sha', result.sha);
        core.setOutput('tag_exists', result.exists.toString());
        core.setOutput('tag_updated', result.updated.toString());
        core.setOutput('tag_created', result.created.toString());
        core.setOutput('platform', repoInfo.platform);
        // Log all outputs when verbose is enabled
        if (inputs.verbose) {
            logger.debug('=== OUTPUTS ===');
            logger.debug(`tag_name: ${result.tagName}`);
            logger.debug(`tag_sha: ${result.sha}`);
            logger.debug(`tag_exists: ${result.exists}`);
            logger.debug(`tag_updated: ${result.updated}`);
            logger.debug(`tag_created: ${result.created}`);
            logger.debug(`platform: ${repoInfo.platform}`);
        }
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
// Run the action (skip if SKIP_RUN is set, e.g., during testing)
if (!process.env.SKIP_RUN) {
    run();
}
//# sourceMappingURL=index.js.map