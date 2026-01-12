import * as exec from '@actions/exec';
import { RepoType, RepositoryInfo, PlatformAPI, PlatformConfig } from '../types';
import { Logger } from '../logger';
import { GitHubAPI, detectFromUrlByHostname as detectGithubFromUrlByHostname, detectFromUrl as detectGithubFromUrl, determineBaseUrl as determineGithubBaseUrl } from './github';
import { GiteaAPI, detectFromUrlByHostname as detectGiteaFromUrlByHostname, detectFromUrl as detectGiteaFromUrl, determineBaseUrl as determineGiteaBaseUrl } from './gitea';
import { BitbucketAPI, detectFromUrlByHostname as detectBitbucketFromUrlByHostname, detectFromUrl as detectBitbucketFromUrl, determineBaseUrl as determineBitbucketBaseUrl } from './bitbucket';
import { GenericGitAPI, detectFromUrlByHostname as detectGenericFromUrlByHostname, detectFromUrl as detectGenericFromUrl, determineBaseUrl as determineGenericBaseUrl } from './generic';

interface PlatformProvider {
  type: RepoType;
  detectFromUrlByHostname: (url: URL) => RepoType | undefined;
  detectFromUrl: (url: URL, logger: Logger) => Promise<RepoType | undefined>;
  createAPI: (repoInfo: RepositoryInfo, config: PlatformConfig, logger: Logger) => PlatformAPI;
}

const platformProviders: PlatformProvider[] = [
  {
    type: 'gitea',
    detectFromUrlByHostname: detectGiteaFromUrlByHostname,
    detectFromUrl: detectGiteaFromUrl,
    createAPI: (repoInfo, config, logger) => new GiteaAPI(repoInfo, config, logger)
  },
  {
    type: 'github',
    detectFromUrlByHostname: detectGithubFromUrlByHostname,
    detectFromUrl: detectGithubFromUrl,
    createAPI: (repoInfo, config, logger) => new GitHubAPI(repoInfo, config, logger)
  },
  {
    type: 'bitbucket',
    detectFromUrlByHostname: detectBitbucketFromUrlByHostname,
    detectFromUrl: detectBitbucketFromUrl,
    createAPI: (repoInfo, config, logger) => new BitbucketAPI(repoInfo, config, logger)
  },
  {
    type: 'generic',
    detectFromUrlByHostname: detectGenericFromUrlByHostname,
    detectFromUrl: detectGenericFromUrl,
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
  logger: Logger
): Promise<RepoType> {
  if (repoType !== 'auto') {
    return repoType;
  }

  if (repoInfo.platform !== 'auto') {
    return repoInfo.platform;
  }

  // Collect candidate URLs
  const candidateUrls = await collectCandidateUrls(repoInfo, logger);

  // First loop: Try detectFromUrlByHostname on each URL
  for (const urlStr of candidateUrls) {
    try {
      const url = new URL(urlStr);

      // Try detectFromUrlByHostname from each provider
      for (const provider of platformProviders) {
        const detected = provider.detectFromUrlByHostname(url);
        if (detected) {
          logger.debug(`Detected platform ${detected} from hostname: ${url.hostname} (URL: ${urlStr})`);
          return detected;
        }
      }
    } catch {
      logger.debug(`Could not parse URL for hostname detection: ${urlStr}`);
    }
  }

  // Second loop: Try detectFromUrl (endpoint probing) on each URL
  for (const urlStr of candidateUrls) {
    try {
      const url = new URL(urlStr);
      // Try detectFromUrl from each provider (excluding generic)
      for (const provider of platformProviders) {
        if (provider.type === 'generic') {
          continue; // Skip generic - it always returns undefined
        }
        const detected = await provider.detectFromUrl(url, logger);
        if (detected) {
          logger.debug(`Detected platform ${detected} from API probe: ${urlStr}`);
          return detected;
        }
      }
    } catch {
      logger.debug(`Could not parse URL for detector probes: ${urlStr}`);
    }
  }

  logger.debug('Could not detect platform, defaulting to generic');
  return 'generic';
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
  const platform = await resolvePlatform(repoInfo, repoType, logger);

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
