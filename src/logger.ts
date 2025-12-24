import * as core from '@actions/core';

/**
 * Logger utility with verbose/debug support
 */
export class Logger {
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    core.info(message);
  }

  /**
   * Log a warning message
   */
  warning(message: string): void {
    core.warning(message);
  }

  /**
   * Log an error message
   */
  error(message: string): void {
    core.error(message);
  }

  /**
   * Log a debug message (only if verbose is enabled)
   */
  debug(message: string): void {
    if (this.verbose) {
      core.info(`[DEBUG] ${message}`);
    }
  }

  /**
   * Log a verbose message (only if verbose is enabled)
   */
  logVerbose(message: string): void {
    if (this.verbose) {
      core.info(`[VERBOSE] ${message}`);
    }
  }

  /**
   * Log an HTTP request (only if verbose is enabled)
   */
  logRequest(method: string, url: string, headers?: Record<string, string>): void {
    if (this.verbose) {
      this.debug(`HTTP ${method} ${url}`);
      if (headers) {
        const sanitizedHeaders = { ...headers };
        if (sanitizedHeaders.Authorization) {
          sanitizedHeaders.Authorization = '***';
        }
        this.debug(`Headers: ${JSON.stringify(sanitizedHeaders, null, 2)}`);
      }
    }
  }

  /**
   * Log an HTTP response (only if verbose is enabled)
   */
  logResponse(status: number, statusText: string, body?: unknown): void {
    if (this.verbose) {
      this.debug(`HTTP Response: ${status} ${statusText}`);
      if (body) {
        this.debug(`Response body: ${JSON.stringify(body, null, 2)}`);
      }
    }
  }

  /**
   * Log a Git command (only if verbose is enabled)
   */
  logGitCommand(command: string, args: string[]): void {
    if (this.verbose) {
      this.debug(`Git command: ${command} ${args.join(' ')}`);
    }
  }
}

