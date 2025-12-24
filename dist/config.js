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
const core = __importStar(require("@actions/core"));
/**
 * Parse boolean input with default value
 */
function getBooleanInput(name, defaultValue = false) {
    const value = core.getInput(name);
    if (value === '') {
        return defaultValue;
    }
    return value.toLowerCase() === 'true';
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
    const validTypes = ['github', 'gitea', 'bitbucket', 'generic', 'auto'];
    const normalized = value.toLowerCase();
    if (validTypes.includes(normalized)) {
        return normalized;
    }
    throw new Error(`Invalid repo_type: ${value}. Must be one of: ${validTypes.join(', ')}`);
}
/**
 * Get and validate action inputs
 */
function getInputs() {
    const tagName = core.getInput('tag_name', { required: true });
    if (!tagName || tagName.trim() === '') {
        throw new Error('tag_name is required and cannot be empty');
    }
    // Validate tag name format (basic validation)
    if (!/^[^/]+$/.test(tagName)) {
        throw new Error(`Invalid tag name: ${tagName}. Tag names cannot contain forward slashes.`);
    }
    const tagMessage = getOptionalInput('tag_message');
    const tagSha = getOptionalInput('tag_sha');
    const repository = getOptionalInput('repository');
    const token = getOptionalInput('token');
    const updateExisting = getBooleanInput('update_existing', false);
    const gpgSign = getBooleanInput('gpg_sign', false);
    const gpgKeyId = getOptionalInput('gpg_key_id');
    const repoTypeStr = core.getInput('repo_type') || 'auto';
    const repoType = parseRepoType(repoTypeStr);
    const baseUrl = getOptionalInput('base_url');
    const ignoreCertErrors = getBooleanInput('ignore_cert_errors', false);
    const force = getBooleanInput('force', false);
    const verbose = getBooleanInput('verbose', false);
    const pushTag = getBooleanInput('push_tag', true);
    // Validate GPG signing requirements
    if (gpgSign && !tagMessage) {
        throw new Error('gpg_sign requires tag_message (GPG signing only works with annotated tags)');
    }
    // Validate GPG key ID if signing is enabled
    if (gpgSign && gpgKeyId && gpgKeyId.trim() === '') {
        throw new Error('gpg_key_id cannot be empty when gpg_sign is true');
    }
    // Validate base URL format if provided
    if (baseUrl) {
        try {
            new URL(baseUrl);
        }
        catch {
            throw new Error(`Invalid base_url format: ${baseUrl}`);
        }
    }
    return {
        tagName: tagName.trim(),
        tagMessage: tagMessage?.trim(),
        tagSha: tagSha?.trim(),
        repository: repository?.trim(),
        token: token || process.env.GITHUB_TOKEN,
        updateExisting,
        gpgSign,
        gpgKeyId: gpgKeyId?.trim(),
        repoType,
        baseUrl,
        ignoreCertErrors,
        force,
        verbose,
        pushTag
    };
}
//# sourceMappingURL=config.js.map