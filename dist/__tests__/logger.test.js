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
const logger_1 = require("../logger");
const core = __importStar(require("@actions/core"));
// Mock @actions/core
jest.mock('@actions/core', () => ({
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    setSecret: jest.fn()
}));
describe('Logger', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('with verbose disabled', () => {
        const logger = new logger_1.Logger(false);
        it('should log info messages', () => {
            logger.info('Test message');
            expect(core.info).toHaveBeenCalledWith('Test message');
        });
        it('should log warning messages', () => {
            logger.warning('Warning message');
            expect(core.warning).toHaveBeenCalledWith('Warning message');
        });
        it('should log error messages', () => {
            logger.error('Error message');
            expect(core.error).toHaveBeenCalledWith('Error message');
        });
        it('should not log debug messages', () => {
            logger.debug('Debug message');
            expect(core.info).not.toHaveBeenCalled();
        });
        it('should not log verbose messages', () => {
            logger.logVerbose('Verbose message');
            expect(core.info).not.toHaveBeenCalled();
        });
        it('should not log HTTP requests', () => {
            logger.logRequest('GET', 'https://example.com', { Authorization: 'token' });
            expect(core.info).not.toHaveBeenCalled();
        });
        it('should not log HTTP responses', () => {
            logger.logResponse(200, 'OK', { data: 'test' });
            expect(core.info).not.toHaveBeenCalled();
        });
        it('should not log Git commands', () => {
            logger.logGitCommand('git', ['tag', 'v1.0.0']);
            expect(core.info).not.toHaveBeenCalled();
        });
    });
    describe('with verbose enabled', () => {
        const logger = new logger_1.Logger(true);
        it('should log debug messages', () => {
            logger.debug('Debug message');
            expect(core.info).toHaveBeenCalledWith('[DEBUG] Debug message');
        });
        it('should log verbose messages', () => {
            logger.logVerbose('Verbose message');
            expect(core.info).toHaveBeenCalledWith('[VERBOSE] Verbose message');
        });
        it('should log HTTP requests', () => {
            logger.logRequest('GET', 'https://example.com/api');
            expect(core.info).toHaveBeenCalledWith('[DEBUG] HTTP GET https://example.com/api');
        });
        it('should log HTTP requests with headers', () => {
            logger.logRequest('POST', 'https://example.com/api', { 'Content-Type': 'application/json' });
            expect(core.info).toHaveBeenCalledTimes(2); // Request and headers
        });
        it('should sanitize Authorization header in logs', () => {
            logger.logRequest('GET', 'https://example.com/api', { Authorization: 'token secret123' });
            const calls = core.info.mock.calls;
            const headersCall = calls.find((call) => call[0].includes('Headers:'));
            expect(headersCall[0]).toContain('"Authorization": "***"');
        });
        it('should log HTTP responses', () => {
            logger.logResponse(200, 'OK', { data: 'test' });
            expect(core.info).toHaveBeenCalledWith('[DEBUG] HTTP Response: 200 OK');
        });
        it('should log HTTP responses with body', () => {
            logger.logResponse(201, 'Created', { id: 123 });
            const calls = core.info.mock.calls;
            expect(calls.some((call) => call[0].includes('Response body'))).toBe(true);
        });
        it('should log Git commands', () => {
            logger.logGitCommand('git', ['tag', 'v1.0.0']);
            expect(core.info).toHaveBeenCalledWith('[DEBUG] Git command: git tag v1.0.0');
        });
    });
});
//# sourceMappingURL=logger.test.js.map