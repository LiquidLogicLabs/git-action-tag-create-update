import { ActionInputs, RepoType } from './types';
/**
 * Get and validate action inputs
 */
export declare function getInputs(): ActionInputs;
/**
 * Resolve token from environment variables based on platform
 * Falls back to platform-specific token environment variables if token is not provided
 */
export declare function resolveToken(token: string | undefined, platform: RepoType): string | undefined;
