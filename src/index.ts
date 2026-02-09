import * as core from '@actions/core';
import { getInputs, resolveToken } from './config';
import { Logger } from './logger';
import { getRepositoryInfo } from './repo-utils';
import { isGitRepository, getHeadSha, createTag, pushTag } from './git';
import { createPlatformAPI } from './platforms/platform-factory';
import { PlatformAPI, TagOptions, RepoType } from './types';

/**
 * Main action function
 */
export async function run(): Promise<void> {
  try {
    // Emit at least one line before any validation so the step never appears completely silent
    // (e.g. if getInputs() throws, we still have evidence the action started)
    core.info('Git Create/Update Tag action started');

    // Get and validate inputs
    const inputs = getInputs();
    const logger = new Logger(inputs.verbose, inputs.debugMode);

    logger.info(`Creating/updating tag: ${inputs.tagName}`);
    
    // Log all inputs when verbose is enabled
    if (inputs.verbose) {
      logger.debug('=== INPUTS ===');
      logger.debug(`tagName: ${inputs.tagName}`);
      logger.debug(`tagSha: ${inputs.tagSha || 'undefined (will use HEAD)'}`);
      if (inputs.tagMessage === undefined) {
        logger.debug(`tagMessage: undefined (will create lightweight tag)`);
      } else {
        const msgLength = inputs.tagMessage.length;
        const msgPreview = inputs.tagMessage.length > 100 
          ? inputs.tagMessage.substring(0, 100) + '...' 
          : inputs.tagMessage;
        logger.debug(`tagMessage: length=${msgLength}, preview="${msgPreview.replace(/\n/g, '\\n')}"`);
      }
      logger.debug(`repository: ${inputs.repository || 'undefined (will use current repo)'}`);
      logger.debug(`token: ${inputs.token ? '*** (explicitly provided)' : 'undefined (will resolve from env based on platform)'}`);
      logger.debug(`repoType: ${inputs.repoType}`);
      logger.debug(`baseUrl: ${inputs.baseUrl || 'undefined (will auto-detect)'}`);
      logger.debug(`updateExisting: ${inputs.updateExisting}`);
      logger.debug(`gpgSign: ${inputs.gpgSign}`);
      logger.debug(`gpgKeyId: ${inputs.gpgKeyId || 'undefined'}`);
      logger.debug(`skipCertificateCheck: ${inputs.ignoreCertErrors}`);
      logger.debug(`force: ${inputs.force}`);
      logger.debug(`pushTag: ${inputs.pushTag}`);
      logger.debug(`gitUserName: ${inputs.gitUserName || 'undefined (will auto-detect)'}`);
      logger.debug(`gitUserEmail: ${inputs.gitUserEmail || 'undefined (will auto-detect)'}`);
      logger.debug(`verbose: ${inputs.verbose}`);
    }

    // Get repository information
    const repoInfo = await getRepositoryInfo(
      inputs.repository,
      inputs.repoType,
      logger
    );

    // Resolve token based on detected platform
    const resolvedToken = resolveToken(inputs.token, repoInfo.platform);

    // Determine if we should use local Git or platform API
    // For github, gitea, and bitbucket platforms, always use the platform API
    // For generic and git platforms, use local Git CLI
    const useLocalGit = await isGitRepository(logger);
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
    } else {
      logger.debug(`Use local Git: ${useLocalGit}, Use platform API: ${usePlatformAPI}`);
    }

    // Get SHA to tag
    let sha = inputs.tagSha;
    if (!sha) {
      if (usePlatformAPI) {
        // When using platform API, get HEAD SHA from the remote repository
        const { platform, api: platformAPI } = await createPlatformAPI(
          repoInfo,
          inputs.repoType,
          {
            token: resolvedToken,
            baseUrl: inputs.baseUrl,
            ignoreCertErrors: inputs.ignoreCertErrors,
            verbose: inputs.verbose,
            pushTag: inputs.pushTag
          },
          logger
        );
        repoInfo.platform = platform;
        sha = await platformAPI.getHeadSha();
        logger.debug(`Using HEAD SHA from remote repository: ${sha}`);
      } else if (useLocalGit) {
        sha = await getHeadSha(logger);
      } else {
        throw new Error(
          'tag_sha is required when not running in a local Git repository and not using a platform API'
        );
      }
    }

    if (!sha) {
      throw new Error('Failed to resolve tag SHA');
    }

    // Prepare tag options
    const tagOptions: TagOptions = {
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
      result = await createTag(tagOptions, logger);

      // Push to remote if push_tag is enabled and we have a remote configured
      if (inputs.pushTag && repoInfo.url) {
        try {
          logger.info(`Pushing tag ${inputs.tagName} to remote`);
          await pushTag(
            inputs.tagName,
            'origin',
            resolvedToken,
            inputs.force,
            logger
          );
          logger.info(`Tag ${inputs.tagName} pushed successfully`);
        } catch (error) {
          logger.warning(`Failed to push tag: ${error}`);
        }
      } else if (!inputs.pushTag) {
        logger.debug('push_tag is false, skipping tag push');
      }
    } else {
      // Use platform API via factory (hostname-first, then per-platform detection)
      const { platform, api: platformAPI } = await createPlatformAPI(
        repoInfo,
        inputs.repoType,
        {
          token: resolvedToken,
          baseUrl: inputs.baseUrl,
          ignoreCertErrors: inputs.ignoreCertErrors,
          verbose: inputs.verbose,
          pushTag: inputs.pushTag
        },
        logger
      );
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
      } else if (exists && inputs.updateExisting) {
        // Tag exists and we should update it
        logger.info(`Updating existing tag: ${inputs.tagName}`);
        result = await platformAPI.updateTag(tagOptions);
      } else {
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
    core.setOutput('tag-name', result.tagName);
    core.setOutput('tag-sha', result.sha);
    core.setOutput('tag-exists', result.exists.toString());
    core.setOutput('tag-updated', result.updated.toString());
    core.setOutput('tag-created', result.created.toString());
    core.setOutput('platform', repoInfo.platform);

    // Log all outputs when verbose is enabled
    if (inputs.verbose) {
      logger.debug('=== OUTPUTS ===');
      logger.debug(`tagName: ${result.tagName}`);
      logger.debug(`tagSha: ${result.sha}`);
      logger.debug(`tagExists: ${result.exists}`);
      logger.debug(`tagUpdated: ${result.updated}`);
      logger.debug(`tagCreated: ${result.created}`);
      logger.debug(`platform: ${repoInfo.platform}`);
    }

    logger.info('Action completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

// Run the action (skip if SKIP_RUN is set, e.g., during testing)
if (!process.env.SKIP_RUN) {
  run();
}

