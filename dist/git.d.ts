import { TagOptions, TagResult } from './types';
import { Logger } from './logger';
/**
 * Check if we're in a Git repository
 */
/**
 * Reject a value git would read as an option rather than as data.
 *
 * An argv array stops the SHELL interpreting a value; it does nothing about git's own
 * option parser, which reads a leading "-" as an option wherever it appears. Some of those
 * options execute commands. Verified against real git:
 *
 *   git push origin --delete '--receive-pack=touch /tmp/PWNED' v9   ->  the file is created
 *
 * (The trailing real ref is required: without it git aborts with "--delete doesn't make
 * sense without any refs" and nothing runs.)
 */
export declare function assertNotOptionLike(value: string | undefined, label: string): void;
/**
 * Reject a tag name git would read as a REFSPEC rather than as a ref.
 *
 * Distinct from the option check and not covered by it. `+` is the force prefix and `:`
 * separates source from destination, so `git push origin '+main'` force-updates the remote
 * BRANCH. `git check-ref-format` accepts `refs/tags/+main` and `git tag` creates it, so the
 * value passes every other check — verified against real git, the remote branch moved to
 * the local HEAD.
 */
export declare function assertNotRefspecLike(value: string, label: string): void;
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
