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
const config_1 = require("../config");
const core = __importStar(require("@actions/core"));
// Mock @actions/core
jest.mock('@actions/core', () => ({
    getInput: jest.fn(),
    setFailed: jest.fn(),
    setSecret: jest.fn()
}));
describe('getInputs', () => {
    const originalEnv = process.env;
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.GITHUB_TOKEN;
    });
    afterEach(() => {
        process.env = originalEnv;
    });
    it('should parse required tag_name', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'tag_name')
                return 'v1.0.0';
            return '';
        });
        const inputs = (0, config_1.getInputs)();
        expect(inputs.tagName).toBe('v1.0.0');
    });
    it('should throw error if tag_name is missing', () => {
        core.getInput.mockImplementation(() => '');
        expect(() => (0, config_1.getInputs)()).toThrow('tag_name is required');
    });
    it('should throw error if tag_name is empty', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'tag_name')
                return '   ';
            return '';
        });
        expect(() => (0, config_1.getInputs)()).toThrow('tag_name is required');
    });
    it('should throw error if tag_name contains forward slash', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'tag_name')
                return 'v1/0/0';
            return '';
        });
        expect(() => (0, config_1.getInputs)()).toThrow('Invalid tag name');
    });
    it('should parse optional inputs with defaults', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'tag_name')
                return 'v1.0.0';
            return '';
        });
        const inputs = (0, config_1.getInputs)();
        expect(inputs.updateExisting).toBe(false);
        expect(inputs.gpgSign).toBe(false);
        expect(inputs.ignoreCertErrors).toBe(false);
        expect(inputs.force).toBe(false);
        expect(inputs.verbose).toBe(false);
        expect(inputs.repoType).toBe('auto');
    });
    it('should parse boolean inputs correctly', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'tag_name')
                return 'v1.0.0';
            if (name === 'tag_message')
                return 'Release v1.0.0'; // Required for gpg_sign
            if (name === 'update_existing')
                return 'true';
            if (name === 'gpg_sign')
                return 'true';
            if (name === 'ignore_cert_errors')
                return 'true';
            if (name === 'force')
                return 'true';
            if (name === 'verbose')
                return 'true';
            return '';
        });
        const inputs = (0, config_1.getInputs)();
        expect(inputs.updateExisting).toBe(true);
        expect(inputs.gpgSign).toBe(true);
        expect(inputs.ignoreCertErrors).toBe(true);
        expect(inputs.force).toBe(true);
        expect(inputs.verbose).toBe(true);
    });
    it('should parse optional string inputs', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'tag_name')
                return 'v1.0.0';
            if (name === 'tag_message')
                return 'Release v1.0.0';
            if (name === 'tag_sha')
                return 'abc123';
            if (name === 'repository')
                return 'owner/repo';
            if (name === 'token')
                return 'token123';
            if (name === 'gpg_key_id')
                return 'key123';
            if (name === 'base_url')
                return 'https://example.com';
            return '';
        });
        const inputs = (0, config_1.getInputs)();
        expect(inputs.tagMessage).toBe('Release v1.0.0');
        expect(inputs.tagSha).toBe('abc123');
        expect(inputs.repository).toBe('owner/repo');
        expect(inputs.token).toBe('token123');
        expect(inputs.gpgKeyId).toBe('key123');
        expect(inputs.baseUrl).toBe('https://example.com');
    });
    it('should use GITHUB_TOKEN from environment if token not provided', () => {
        process.env.GITHUB_TOKEN = 'env-token';
        core.getInput.mockImplementation((name) => {
            if (name === 'tag_name')
                return 'v1.0.0';
            return '';
        });
        const inputs = (0, config_1.getInputs)();
        expect(inputs.token).toBe('env-token');
    });
    it('should parse repo_type correctly', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'tag_name')
                return 'v1.0.0';
            if (name === 'repo_type')
                return 'github';
            return '';
        });
        const inputs = (0, config_1.getInputs)();
        expect(inputs.repoType).toBe('github');
    });
    it('should throw error for invalid repo_type', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'tag_name')
                return 'v1.0.0';
            if (name === 'repo_type')
                return 'invalid';
            return '';
        });
        expect(() => (0, config_1.getInputs)()).toThrow('Invalid repo_type');
    });
    it('should throw error if gpg_sign is true but tag_message is missing', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'tag_name')
                return 'v1.0.0';
            if (name === 'gpg_sign')
                return 'true';
            return '';
        });
        expect(() => (0, config_1.getInputs)()).toThrow('gpg_sign requires tag_message');
    });
    it('should throw error for invalid base_url format', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'tag_name')
                return 'v1.0.0';
            if (name === 'base_url')
                return 'not-a-url';
            return '';
        });
        expect(() => (0, config_1.getInputs)()).toThrow('Invalid base_url format');
    });
    it('should trim whitespace from inputs', () => {
        core.getInput.mockImplementation((name) => {
            if (name === 'tag_name')
                return '  v1.0.0  ';
            if (name === 'tag_message')
                return '  Release  ';
            return '';
        });
        const inputs = (0, config_1.getInputs)();
        expect(inputs.tagName).toBe('v1.0.0');
        expect(inputs.tagMessage).toBe('Release');
    });
});
//# sourceMappingURL=config.test.js.map