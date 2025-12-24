import * as core from '@actions/core';
import { getInputs } from './config';
import { Logger } from './logger';
import { getRepositoryInfo } from './platform-detector';
import { isGitRepository, getHeadSha, createTag, pushTag } from './git';
import { GitHubAPI } from './platforms/github';
import { GiteaAPI } from './platforms/gitea';
import { BitbucketAPI } from './platforms/bitbucket';
import { GenericGitAPI } from './platforms/generic';
import { PlatformAPI, TagOptions, RepoType } from './types';

/**
 * Create platform API instance
 */
function createPlatformAPI(
  repoType: RepoType,
  repoInfo: { owner: string; repo: string; platform: RepoType },
  config: {
    token?: string;
    baseUrl?: string;
    ignoreCertErrors: boolean;
    verbose: boolean;
  },
  logger: Logger
): PlatformAPI {
  const platformConfig = {
    type: repoType,
    baseUrl: config.baseUrl,
    token: config.token,
    ignoreCertErrors: config.ignoreCertErrors,
    verbose: config.verbose
  };

  switch (repoType) {
    case 'github':
      return new GitHubAPI(repoInfo, platformConfig, logger);
    case 'gitea':
      return new GiteaAPI(repoInfo, platformConfig, logger);
    case 'bitbucket':
      return new BitbucketAPI(repoInfo, platformConfig, logger);
    case 'generic':
    default:
      return new GenericGitAPI(repoInfo, platformConfig, logger);
  }
}

/**
 * Main action function
 */
async function run(): Promise<void> {
  try {
    // Get and validate inputs
    const inputs = getInputs();
    const logger = new Logger(inputs.verbose);

    logger.info(`Creating/updating tag: ${inputs.tagName}`);

    // Get repository information
    const repoInfo = await getRepositoryInfo(
      inputs.repository,
      inputs.repoType,
      logger
    );

    // Determine if we should use local Git or platform API
    const useLocalGit = await isGitRepository(logger);
    const usePlatformAPI = !useLocalGit || repoInfo.platform !== 'generic';

    logger.debug(`Use local Git: ${useLocalGit}, Use platform API: ${usePlatformAPI}`);

    // Get SHA to tag
    let sha = inputs.tagSha;
    if (!sha) {
      if (useLocalGit) {
        sha = await getHeadSha(logger);
      } else {
        throw new Error(
          'tag_sha is required when not running in a local Git repository'
        );
      }
    }

    // Prepare tag options
    const tagOptions: TagOptions = {
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
      result = await createTag(tagOptions, logger);

      // Push to remote if we have a remote configured
      if (repoInfo.url) {
        try {
          await pushTag(
            inputs.tagName,
            'origin',
            inputs.token,
            inputs.force,
            logger
          );
        } catch (error) {
          logger.warning(`Failed to push tag: ${error}`);
        }
      }
    } else {
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

      const platformAPI = createPlatformAPI(
        repoInfo.platform,
        repoInfo,
        {
          token: inputs.token,
          baseUrl,
          ignoreCertErrors: inputs.ignoreCertErrors,
          verbose: inputs.verbose
        },
        logger
      );

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
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

// Run the action
run();

