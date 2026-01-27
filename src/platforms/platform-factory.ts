import * as exec from '@actions/exec';
import { RepoType, RepositoryInfo, PlatformAPI, PlatformConfig } from '../types';
import { Logger } from '../logger';
import { createByName, detectPlatform, getBuiltInProviders } from 'git-platform-detector';
import { GitHubAPI, determineBaseUrl as determineGithubBaseUrl } from './github';
import { GiteaAPI, determineBaseUrl as determineGiteaBaseUrl } from './gitea';
import { BitbucketAPI, determineBaseUrl as determineBitbucketBaseUrl } from './bitbucket';
import { GenericGitAPI, determineBaseUrl as determineGenericBaseUrl } from './generic';

interface PlatformProvider {
  type: RepoType;
  createAPI: (repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger) => PlatformAPI;
}

const platformProviders: PlatformProvider[] = [
  {
    type: 'gitea',
    createAPI: (repoInfo, config, logger) => new GiteaAPI(repoInfo, config, logger)
  },
  {
    type: 'github',
    createAPI: (repoInfo, config, logger) => new GitHubAPI(repoInfo, config, logger)
  },
  {
    type: 'bitbucket',
    createAPI: (repoInfo, config, logger) => new BitbucketAPI(repoInfo, config, logger)
  },
  {
    type: 'generic',
    createAPI: (repoInfo, config, logger) => new GenericGitAPI(repoInfo, config, logger)
  }
];

/**
 * Collect candidate URLs from repository URL, origin URL, and environment variables
 */
async function collectCandidateUrls(repoInfo: RepositoryInfo, logger: Logger): Promise<string[]> {
  const urls: string[] = [];

  // Add repository URL if available
  if (repoInfo.url) {
    urls.push(repoInfo.url);
  }

  // Try to get origin URL from git
  try {
    const output: string[] = [];
    await exec.exec('git', ['config', '--get', 'remote.origin.url'], {
      silent: true,
      listeners: {
        stdout: (data: Buffer) => {
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
  } catch {
    // Git not available or no origin - skip
  }

  // Add environment variable URLs
  const envUrls = [
    process.env.GITHUB_SERVER_URL,
    process.env.GITEA_SERVER_URL,
    process.env.GITEA_API_URL
  ].filter((url): url is string => !!url);

  for (const envUrl of envUrls) {
    if (!urls.includes(envUrl)) {
      urls.push(envUrl);
      logger.debug(`Added environment URL: ${envUrl}`);
    }
  }

  return urls;
}

async function resolvePlatform(
  repoInfo: RepositoryInfo,
  repoType: RepoType,
  logger: Logger,
  token?: string
): Promise<RepoType> {
  if (repoType !== 'auto') {
    // git-platform-detector now supports 'git' and 'local' as aliases for 'generic'
    createByName(repoType, { providers: getBuiltInProviders() });
    // Return 'generic' for 'git' to maintain consistency with internal provider types
    return repoType === 'git' ? 'generic' : repoType;
  }

  if (repoInfo.platform !== 'auto') {
    // git-platform-detector now supports 'git' and 'local' as aliases for 'generic'
    createByName(repoInfo.platform, { providers: getBuiltInProviders() });
    // Return 'generic' for 'git' to maintain consistency with internal provider types
    return repoInfo.platform === 'git' ? 'generic' : repoInfo.platform;
  }

  // Collect candidate URLs
  const candidateUrls = await collectCandidateUrls(repoInfo, logger);

  const detection = await detectPlatform({
    providers: getBuiltInProviders(),
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

export async function createPlatformAPI(
  repoInfo: RepositoryInfo,
  repoType: RepoType,
  config: {
    token?: string;
    baseUrl?: string;
    ignoreCertErrors: boolean;
    verbose: boolean;
    pushTag?: boolean;
  },
  logger: Logger
): Promise<{ platform: RepoType; api: PlatformAPI; baseUrl?: string }> {
  const platform = await resolvePlatform(repoInfo, repoType, logger, config.token);

  // Find the provider for the resolved platform
  const provider = platformProviders.find(p => p.type === platform) || platformProviders.find(p => p.type === 'generic')!;

  // Collect candidate URLs for base URL determination
  const candidateUrls = await collectCandidateUrls(repoInfo, logger);
  
  // If explicit baseUrl is provided, prepend it to the array
  const urlsForBaseUrl = config.baseUrl ? [config.baseUrl, ...candidateUrls] : candidateUrls;
  
  // Determine base URL using the platform's internal function (not part of interface)
  let determineBaseUrlFn: (urls: string | string[]) => string | undefined;
  switch (platform) {
    case 'github':
      determineBaseUrlFn = determineGithubBaseUrl;
      break;
    case 'gitea':
      determineBaseUrlFn = determineGiteaBaseUrl;
      break;
    case 'bitbucket':
      determineBaseUrlFn = determineBitbucketBaseUrl;
      break;
    default:
      determineBaseUrlFn = determineGenericBaseUrl;
      break;
  }
  const baseUrl = determineBaseUrlFn(urlsForBaseUrl);

  const platformConfig: PlatformConfig = {
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
