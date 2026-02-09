/**
 * Logger utility with verbose/debug support
 */
export declare class Logger {
    readonly verbose: boolean;
    readonly debugMode: boolean;
    constructor(verbose?: boolean, debugMode?: boolean);
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
     * Log verbose operational info - shown when verbose=true or debug=true
     * No prefix, appears as clean info lines
     */
    verboseInfo(message: string): void;
    /**
     * Log a debug message - uses core.info() when debugMode is true so it always shows
     * Falls back to core.debug() when debugMode is false (for when ACTIONS_STEP_DEBUG is set at workflow level)
     */
    debug(message: string): void;
    isVerbose(): boolean;
    isDebug(): boolean;
}
