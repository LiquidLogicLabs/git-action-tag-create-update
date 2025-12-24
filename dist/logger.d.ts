/**
 * Logger utility with verbose/debug support
 */
export declare class Logger {
    private verbose;
    constructor(verbose?: boolean);
    /**
     * Log an info message
     */
    info(message: string): void;
    /**
     * Log a warning message
     */
    warning(message: string): void;
    /**
     * Log an error message
     */
    error(message: string): void;
    /**
     * Log a debug message (only if verbose is enabled)
     */
    debug(message: string): void;
    /**
     * Log a verbose message (only if verbose is enabled)
     */
    logVerbose(message: string): void;
    /**
     * Log an HTTP request (only if verbose is enabled)
     */
    logRequest(method: string, url: string, headers?: Record<string, string>): void;
    /**
     * Log an HTTP response (only if verbose is enabled)
     */
    logResponse(status: number, statusText: string, body?: unknown): void;
    /**
     * Log a Git command (only if verbose is enabled)
     */
    logGitCommand(command: string, args: string[]): void;
}
