import winston from 'winston';

describe('Logger Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear any winston instances
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use file transport by default', () => {
    delete process.env.LOG_OUTPUT;
    const { logger } = require('../logger');

    expect(logger.transports).toHaveLength(1);
    expect(logger.transports[0]).toBeInstanceOf(winston.transports.File);
    expect((logger.transports[0] as winston.transports.FileTransportInstance).filename).toBe(
      'dynatrace-managed-mcp.log',
    );
  });

  it('should use custom file path when LOG_FILE is set', () => {
    process.env.LOG_OUTPUT = 'file';
    process.env.LOG_FILE = 'custom-log-path.log';
    jest.resetModules();
    const { logger } = require('../logger');

    expect(logger.transports).toHaveLength(1);
    expect(logger.transports[0]).toBeInstanceOf(winston.transports.File);
    expect((logger.transports[0] as winston.transports.FileTransportInstance).filename).toBe('custom-log-path.log');
  });

  it('should use stderr transport for errors/warnings only', () => {
    process.env.LOG_OUTPUT = 'stderr';
    jest.resetModules();
    const { logger } = require('../logger');

    expect(logger.transports).toHaveLength(1);
    expect(logger.transports[0]).toBeInstanceOf(winston.transports.Console);
    const stderrLevels = (logger.transports[0] as winston.transports.ConsoleTransportInstance).stderrLevels;
    expect(stderrLevels).toBeDefined();
    expect(stderrLevels).toHaveProperty('error');
    expect(stderrLevels).toHaveProperty('warn');
  });

  it('should use stderr-all transport for all log levels', () => {
    process.env.LOG_OUTPUT = 'stderr-all';
    jest.resetModules();
    const { logger } = require('../logger');

    expect(logger.transports).toHaveLength(1);
    expect(logger.transports[0]).toBeInstanceOf(winston.transports.Console);
    const stderrLevels = (logger.transports[0] as winston.transports.ConsoleTransportInstance).stderrLevels;
    expect(stderrLevels).toBeDefined();
    expect(stderrLevels).toHaveProperty('info');
    expect(stderrLevels).toHaveProperty('debug');
  });

  it('should use stdout transport when LOG_OUTPUT is console', () => {
    process.env.LOG_OUTPUT = 'console';
    jest.resetModules();
    const { logger } = require('../logger');

    expect(logger.transports).toHaveLength(1);
    expect(logger.transports[0]).toBeInstanceOf(winston.transports.Console);
    const transport = logger.transports[0] as winston.transports.ConsoleTransportInstance;
    const stderrLevels = transport.stderrLevels;
    if (stderrLevels) {
      expect(Object.keys(stderrLevels)).toHaveLength(0);
    }
  });

  it('should use stdout transport when LOG_OUTPUT is stdout', () => {
    process.env.LOG_OUTPUT = 'stdout';
    jest.resetModules();
    const { logger } = require('../logger');

    expect(logger.transports).toHaveLength(1);
    expect(logger.transports[0]).toBeInstanceOf(winston.transports.Console);
  });

  it('should use both file and stdout when LOG_OUTPUT is file+console', () => {
    process.env.LOG_OUTPUT = 'file+console';
    process.env.LOG_FILE = 'test.log';
    jest.resetModules();
    const { logger } = require('../logger');

    expect(logger.transports).toHaveLength(2);
    expect(logger.transports[0]).toBeInstanceOf(winston.transports.File);
    expect(logger.transports[1]).toBeInstanceOf(winston.transports.Console);
    expect((logger.transports[0] as winston.transports.FileTransportInstance).filename).toBe('test.log');
  });

  it('should use both file and stdout when LOG_OUTPUT is file+stdout', () => {
    process.env.LOG_OUTPUT = 'file+stdout';
    jest.resetModules();
    const { logger } = require('../logger');

    expect(logger.transports).toHaveLength(2);
    expect(logger.transports[0]).toBeInstanceOf(winston.transports.File);
    expect(logger.transports[1]).toBeInstanceOf(winston.transports.Console);
  });

  it('should use both file and stderr when LOG_OUTPUT is file+stderr', () => {
    process.env.LOG_OUTPUT = 'file+stderr';
    process.env.LOG_FILE = 'combined.log';
    jest.resetModules();
    const { logger } = require('../logger');

    expect(logger.transports).toHaveLength(2);
    expect(logger.transports[0]).toBeInstanceOf(winston.transports.File);
    expect(logger.transports[1]).toBeInstanceOf(winston.transports.Console);
    expect((logger.transports[0] as winston.transports.FileTransportInstance).filename).toBe('combined.log');
    const stderrLevels = (logger.transports[1] as winston.transports.ConsoleTransportInstance).stderrLevels;
    expect(stderrLevels).toBeDefined();
    expect(stderrLevels).toHaveProperty('error');
    expect(stderrLevels).toHaveProperty('warn');
  });

  it('should have no transports when LOG_OUTPUT is disabled', () => {
    process.env.LOG_OUTPUT = 'disabled';
    jest.resetModules();
    const { logger } = require('../logger');

    expect(logger.transports).toHaveLength(0);
  });

  it('should default to info log level', () => {
    delete process.env.LOG_LEVEL;
    jest.resetModules();
    const { logger } = require('../logger');

    expect(logger.level).toBe('info');
  });

  it('should respect custom log level', () => {
    process.env.LOG_LEVEL = 'debug';
    jest.resetModules();
    const { logger } = require('../logger');

    expect(logger.level).toBe('debug');
  });

  it('should handle case-insensitive LOG_OUTPUT values', () => {
    process.env.LOG_OUTPUT = 'CONSOLE';
    jest.resetModules();
    const { logger } = require('../logger');

    expect(logger.transports).toHaveLength(1);
    expect(logger.transports[0]).toBeInstanceOf(winston.transports.Console);
  });
});
