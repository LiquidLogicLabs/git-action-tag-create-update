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
exports.getInputs = getInputs;
exports.resolveToken = resolveToken;
const core = __importStar(require("@actions/core"));
/**
 * Parse a string as a boolean (case-insensitive).
 * Returns true for '1' or 'true', false for '0' or 'false'.
 * Empty/undefined/whitespace uses defaultValue; unknown values are treated as false.
 */
function parseBoolean(value, defaultValue = false) {
    const s = (value ?? '').trim().toLowerCase();
    if (s === '') {
        return defaultValue;
    }
    if (s === 'true' || s === '1') {
        return true;
    }
    if (s === 'false' || s === '0') {
        return false;
    }
    return false;
}
/**
 * Get boolean action input with default value.
 * Uses parseBoolean so '1'/'0' and 'true'/'false' (any case) are accepted.
 */
function getBooleanInput(name, defaultValue = false) {
    const value = core.getInput(name);
    return parseBoolean(value === '' ? undefined : value, defaultValue);
}
/**
 * Get optional string input
 */
function getOptionalInput(name) {
    const value = core.getInput(name);
    return value === '' ? undefined : value;
}
/**
 * Parse and validate repo type
 */
function parseRepoType(value) {
    const validTypes = ['github', 'gitea', 'bitbucket', 'generic', 'git', 'auto'];
    const normalized = value.toLowerCase();
    if (validTypes.includes(normalized)) {
        return normalized;
    }
    throw new Error(`Invalid repoType: ${value}. Must be one of: ${validTypes.join(', ')}`);
}
/**
 * Get and validate action inputs
 */
function getInputs() {
    const tagName = core.getInput('tagName', { required: true });
    if (!tagName || tagName.trim() === '') {
        throw new Error('tagName is required and cannot be empty');
    }
    // Validate tag name format (basic validation)
    if (!/^[^/]+$/.test(tagName)) {
        throw new Error(`Invalid tag name: ${tagName}. Tag names cannot contain forward slashes.`);
    }
    const tagMessage = getOptionalInput('tagMessage');
    const tagSha = getOptionalInput('tagSha');
    const repository = getOptionalInput('repository');
    const token = getOptionalInput('token');
    const force = getBooleanInput('force', false);
    const updateExisting = getBooleanInput('updateExisting', false) || force;
    const gpgSign = getBooleanInput('gpgSign', false);
    const gpgKeyId = getOptionalInput('gpgKeyId');
    const repoTypeStr = core.getInput('repoType') || 'auto';
    const repoType = parseRepoType(repoTypeStr);
    const baseUrl = getOptionalInput('baseUrl');
    const ignoreCertErrors = getBooleanInput('skipCertificateCheck', false);
    const verboseInput = getBooleanInput('verbose', false);
    const stepDebugEnabled = (typeof core.isDebug === 'function' && core.isDebug()) ||
        parseBoolean(process.env.ACTIONS_STEP_DEBUG) ||
        parseBoolean(process.env.ACTIONS_RUNNER_DEBUG) ||
        parseBoolean(process.env.RUNNER_DEBUG);
    const verbose = verboseInput || stepDebugEnabled;
    const pushTag = getBooleanInput('pushTag', true);
    const gitUserName = getOptionalInput('gitUserName');
    const gitUserEmail = getOptionalInput('gitUserEmail');
    // Validate GPG signing requirements
    if (gpgSign && !tagMessage) {
        throw new Error('gpgSign requires tagMessage (GPG signing only works with annotated tags)');
    }
    // Validate GPG key ID if signing is enabled
    if (gpgSign && gpgKeyId && gpgKeyId.trim() === '') {
        throw new Error('gpgKeyId cannot be empty when gpgSign is true');
    }
    // Validate base URL format if provided
    if (baseUrl) {
        try {
            new URL(baseUrl);
        }
        catch {
            throw new Error(`Invalid baseUrl format: ${baseUrl}`);
        }
    }
    const normalizedTagMessage = tagMessage?.trim() || undefined;
    return {
        tagName: tagName.trim(),
        tagMessage: normalizedTagMessage, // Normalize empty strings to undefined
        tagSha: tagSha?.trim(),
        repository: repository?.trim(),
        token: token, // Don't set default here - will be resolved based on platform
        updateExisting,
        gpgSign,
        gpgKeyId: gpgKeyId?.trim(),
        repoType,
        baseUrl,
        ignoreCertErrors,
        force,
        verbose,
        pushTag,
        gitUserName,
        gitUserEmail
    };
}
/**
 * Resolve token from environment variables based on platform
 * Falls back to platform-specific token environment variables if token is not provided
 */
function resolveToken(token, platform) {
    // If token is explicitly provided, use it
    if (token) {
        return token;
    }
    // Otherwise, try platform-specific environment variables
    switch (platform) {
        case 'github':
            return process.env.GITHUB_TOKEN;
        case 'gitea':
            return process.env.GITEA_TOKEN || process.env.GITHUB_TOKEN; // Gitea Actions also provides GITHUB_TOKEN
        case 'bitbucket':
            return process.env.BITBUCKET_TOKEN;
        case 'generic':
        case 'git':
        default:
            // For generic/git, try common token environment variables
            return (process.env.GITHUB_TOKEN ||
                process.env.GITEA_TOKEN ||
                process.env.BITBUCKET_TOKEN);
    }
}
//# sourceMappingURL=config.js.map