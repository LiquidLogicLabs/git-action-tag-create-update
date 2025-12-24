"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const core = __importStar(require("@actions/core"));
/**
 * Logger utility with verbose/debug support
 */
class Logger {
    verbose;
    constructor(verbose = false) {
        this.verbose = verbose;
    }
    /**
     * Log an info message
     */
    info(message) {
        core.info(message);
    }
    /**
     * Log a warning message
     */
    warning(message) {
        core.warning(message);
    }
    /**
     * Log an error message
     */
    error(message) {
        core.error(message);
    }
    /**
     * Log a debug message (only if verbose is enabled)
     */
    debug(message) {
        if (this.verbose) {
            core.info(`[DEBUG] ${message}`);
        }
    }
    /**
     * Log a verbose message (only if verbose is enabled)
     */
    logVerbose(message) {
        if (this.verbose) {
            core.info(`[VERBOSE] ${message}`);
        }
    }
    /**
     * Log an HTTP request (only if verbose is enabled)
     */
    logRequest(method, url, headers) {
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
    logResponse(status, statusText, body) {
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
    logGitCommand(command, args) {
        if (this.verbose) {
            this.debug(`Git command: ${command} ${args.join(' ')}`);
        }
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map