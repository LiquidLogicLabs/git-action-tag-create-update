import { TagOptions, TagResult } from './types';
import { Logger } from './logger';
/**
 * Check if we're in a Git repository
 */
export declare function isGitRepository(_logger: Logger): Promise<boolean>;
/**
 * Check if a tag exists locally
 */
export declare function tagExistsLocally(tagName: string, _logger: Logger): Promise<boolean>;
/**
 * Get current HEAD SHA
 */
export declare function getHeadSha(_logger: Logger): Promise<string>;
/**
 * Ensure git user.name and user.email are configured
 * Returns true if configuration was set, false if already configured
 */
export declare function ensureGitUserConfig(logger: Logger, userName?: string, userEmail?: string): Promise<boolean>;
/**
 * Create a tag using Git CLI
 */
export declare function createTag(options: TagOptions, logger: Logger): Promise<TagResult>;
/**
 * Get the SHA that a tag points to
 */
export declare function getTagSha(tagName: string, _logger: Logger): Promise<string>;
/**
 * Push tag to remote
 */
export declare function pushTag(tagName: string, remote: string, token: string | undefined, force: boolean, logger: Logger): Promise<void>;
/**
 * Delete a tag locally
 */
export declare function deleteTagLocally(tagName: string, logger: Logger): Promise<void>;
/**
 * Delete a tag from remote
 */
export declare function deleteTagRemote(tagName: string, remote: string, token: string | undefined, logger: Logger): Promise<void>;
