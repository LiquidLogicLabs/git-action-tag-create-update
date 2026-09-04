import { RepoType, RepositoryInfo } from './types';
import { Logger } from './logger';
/**
 * Parse repository URL or owner/repo format
 */
export declare function parseRepository(repository: string | undefined, logger: Logger): RepositoryInfo | undefined;
/**
 * Get repository info from local Git repository
 */
export declare function getLocalRepositoryInfo(logger: Logger): Promise<RepositoryInfo | undefined>;
/**
 * Get full repository information
 */
export declare function getRepositoryInfo(repository: string | undefined, repoType: RepoType, logger: Logger): Promise<RepositoryInfo>;
/**
 * Encode a value for use as a single path segment in an API URL.
 *
 * Interpolating a value straight into a path lets it redirect the request. Verified against
 * WHATWG URL resolution, which is what fetch applies:
 *
 *   tag "../../../user"  ->  /repos/o/r/git/refs/tags/../../../user  =>  /repos/o/user
 *   tag ".."             ->  /repos/o/r/git/refs/tags/..             =>  /repos/o/r/git/refs/
 *
 * This action issues DELETE against these paths (deleteTag on every platform client), so a
 * redirected request acts on the refs collection rather than on one tag.
 *
 * encodeURIComponent is necessary but not sufficient: it does not encode dots, so a bare
 * "." or ".." survives it unchanged and is then removed by dot-segment normalisation. Those
 * two are refused outright rather than encoded, because no legitimate tag, owner, repo or
 * branch is named "." or "..".
 */
export declare function safeSegment(value: string, label: string): string;
