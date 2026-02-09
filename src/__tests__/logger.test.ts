import { Logger } from '../logger';
import * as core from '@actions/core';

// Mock @actions/core
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setSecret: jest.fn()
}));

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('with both verbose and debugMode disabled', () => {
    const logger = new Logger(false, false);

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

    it('should not log verboseInfo messages', () => {
      logger.verboseInfo('Verbose message');
      expect(core.info).not.toHaveBeenCalled();
    });

    it('should log debug messages using core.debug()', () => {
      logger.debug('Debug message');
      expect(core.debug).toHaveBeenCalledWith('Debug message');
      expect(core.info).not.toHaveBeenCalled();
    });

    it('should expose verbose and debugMode properties', () => {
      expect(logger.verbose).toBe(false);
      expect(logger.debugMode).toBe(false);
      expect(logger.isVerbose()).toBe(false);
      expect(logger.isDebug()).toBe(false);
    });
  });

  describe('with verbose enabled (debugMode disabled)', () => {
    const logger = new Logger(true, false);

    it('should log verboseInfo messages', () => {
      logger.verboseInfo('Verbose message');
      expect(core.info).toHaveBeenCalledWith('Verbose message');
    });

    it('should log debug messages using core.debug() (not [DEBUG] prefix)', () => {
      logger.debug('Debug message');
      expect(core.debug).toHaveBeenCalledWith('Debug message');
      expect(core.info).not.toHaveBeenCalled();
    });

    it('should expose verbose property as true', () => {
      expect(logger.verbose).toBe(true);
      expect(logger.debugMode).toBe(false);
      expect(logger.isVerbose()).toBe(true);
      expect(logger.isDebug()).toBe(false);
    });
  });

  describe('with debugMode enabled', () => {
    const logger = new Logger(false, true);

    it('should imply verbose when debugMode is true', () => {
      expect(logger.verbose).toBe(true);
      expect(logger.debugMode).toBe(true);
    });

    it('should log verboseInfo messages', () => {
      logger.verboseInfo('Verbose message');
      expect(core.info).toHaveBeenCalledWith('Verbose message');
    });

    it('should log debug messages using core.info() with [DEBUG] prefix', () => {
      logger.debug('Debug message');
      expect(core.info).toHaveBeenCalledWith('[DEBUG] Debug message');
      expect(core.debug).not.toHaveBeenCalled();
    });

    it('should expose debugMode properties', () => {
      expect(logger.isVerbose()).toBe(true);
      expect(logger.isDebug()).toBe(true);
    });
  });

  describe('default constructor', () => {
    it('should default to verbose=false, debugMode=false', () => {
      const logger = new Logger();
      expect(logger.verbose).toBe(false);
      expect(logger.debugMode).toBe(false);
      logger.debug('Test');
      expect(core.debug).toHaveBeenCalledWith('Test');
      expect(core.info).not.toHaveBeenCalled();
    });
  });
});
