import { Logger } from '../logger';
import * as core from '@actions/core';

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
    const logger = new Logger(false);

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
    const logger = new Logger(true);

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
      const calls = (core.info as jest.Mock).mock.calls;
      const headersCall = calls.find((call: string[]) => call[0].includes('Headers:'));
      expect(headersCall[0]).toContain('"Authorization": "***"');
    });

    it('should log HTTP responses', () => {
      logger.logResponse(200, 'OK', { data: 'test' });
      expect(core.info).toHaveBeenCalledWith('[DEBUG] HTTP Response: 200 OK');
    });

    it('should log HTTP responses with body', () => {
      logger.logResponse(201, 'Created', { id: 123 });
      const calls = (core.info as jest.Mock).mock.calls;
      expect(calls.some((call: string[]) => call[0].includes('Response body'))).toBe(true);
    });

    it('should log Git commands', () => {
      logger.logGitCommand('git', ['tag', 'v1.0.0']);
      expect(core.info).toHaveBeenCalledWith('[DEBUG] Git command: git tag v1.0.0');
    });
  });
});

