import winston from 'winston';
import axios, { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { createLogger, sanitizeErrors } from '../logger';
import { TransformableInfo } from 'logform';

function buildAxiosError(): AxiosError {
  const requestConfig: InternalAxiosRequestConfig = {
    method: 'get',
    url: '/api/v2/metrics',
    headers: new AxiosHeaders({ Authorization: 'Api-Token super-secret-value', Cookie: 'sso=abc123' }),
  };
  const response: AxiosResponse = {
    status: 401,
    statusText: 'Unauthorized',
    headers: { 'set-cookie': ['session=leak-me'] },
    data: {},
    config: requestConfig,
  };
  return new axios.AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', requestConfig, {}, response);
}

describe('sanitizeErrors', () => {
  it('strips config/request/response when an AxiosError is logged directly', () => {
    const axiosError = buildAxiosError();
    expect(JSON.stringify(axiosError)).toContain('super-secret-value');
    expect(JSON.stringify(axiosError)).toContain('abc123');
    const info = sanitizeErrors().transform({ ...axiosError, level: 'error' }, {}) as TransformableInfo;

    expect(JSON.stringify(info)).not.toContain('super-secret-value');
    expect(JSON.stringify(info)).not.toContain('abc123');
    expect(JSON.stringify(info)).not.toContain('leak-me');
    expect(info.message).toBe('Request failed with status code 401');
  });

  it('reduces a nested AxiosError in metadata (e.g. { error: err }) down to its message', () => {
    const axiosError = buildAxiosError();
    expect(JSON.stringify(axiosError)).toContain('super-secret-value');
    expect(JSON.stringify(axiosError)).toContain('abc123');
    const info = sanitizeErrors().transform(
      { level: 'error', message: 'Failed calling endpoint', error: axiosError },
      {},
    ) as TransformableInfo;

    expect(info.error).toBe('Request failed with status code 401');
    expect(JSON.stringify(info)).not.toContain('super-secret-value');
    expect(JSON.stringify(info)).not.toContain('abc123');
  });

  it('reduces any nested Error instance in metadata to its message, not just AxiosError', () => {
    const info = sanitizeErrors().transform(
      { level: 'warn', message: 'Something failed', error: new Error('plain failure') },
      {},
    ) as Record<string, unknown>;

    expect(info.error).toBe('plain failure');
  });

  it('leaves non-Error metadata untouched', () => {
    const info = sanitizeErrors().transform(
      { level: 'debug', message: 'queryLogs response', data: { rows: [1, 2, 3] } },
      {},
    ) as Record<string, unknown>;

    expect(info.data).toEqual({ rows: [1, 2, 3] });
  });
});

describe('Logger Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use file transport by default', () => {
    delete process.env.LOG_OUTPUT;

    const testLogger = createLogger();

    expect(testLogger.transports).toHaveLength(1);
    expect(testLogger.transports[0]).toBeInstanceOf(winston.transports.File);
    expect((testLogger.transports[0] as winston.transports.FileTransportInstance).filename).toBe(
      'dynatrace-managed-mcp.log',
    );
  });

  it('should use custom file path when LOG_FILE is set', () => {
    process.env.LOG_OUTPUT = 'file';
    process.env.LOG_FILE = 'custom-log-path.log';

    const testLogger = createLogger();

    expect(testLogger.transports).toHaveLength(1);
    expect(testLogger.transports[0]).toBeInstanceOf(winston.transports.File);
    expect((testLogger.transports[0] as winston.transports.FileTransportInstance).filename).toBe('custom-log-path.log');
  });

  it('should use stderr transport for errors/warnings only', () => {
    process.env.LOG_OUTPUT = 'stderr';

    const testLogger = createLogger();

    expect(testLogger.transports).toHaveLength(1);
    expect(testLogger.transports[0]).toBeInstanceOf(winston.transports.Console);
    const stderrLevels = (testLogger.transports[0] as winston.transports.ConsoleTransportInstance).stderrLevels;
    expect(stderrLevels).toBeDefined();
    expect(stderrLevels).toHaveProperty('error');
    expect(stderrLevels).toHaveProperty('warn');
  });

  it('should use stderr-all transport for all log levels', () => {
    process.env.LOG_OUTPUT = 'stderr-all';

    const testLogger = createLogger();

    expect(testLogger.transports).toHaveLength(1);
    expect(testLogger.transports[0]).toBeInstanceOf(winston.transports.Console);
    const stderrLevels = (testLogger.transports[0] as winston.transports.ConsoleTransportInstance).stderrLevels;
    expect(stderrLevels).toBeDefined();
    expect(stderrLevels).toHaveProperty('info');
    expect(stderrLevels).toHaveProperty('debug');
  });

  it('should use stdout transport when LOG_OUTPUT is console', () => {
    process.env.LOG_OUTPUT = 'console';

    const testLogger = createLogger();

    expect(testLogger.transports).toHaveLength(1);
    expect(testLogger.transports[0]).toBeInstanceOf(winston.transports.Console);
    const transport = testLogger.transports[0] as winston.transports.ConsoleTransportInstance;
    const stderrLevels = transport.stderrLevels;
    if (stderrLevels) {
      expect(Object.keys(stderrLevels)).toHaveLength(0);
    }
  });

  it('should use stdout transport when LOG_OUTPUT is stdout', () => {
    process.env.LOG_OUTPUT = 'stdout';

    const testLogger = createLogger();

    expect(testLogger.transports).toHaveLength(1);
    expect(testLogger.transports[0]).toBeInstanceOf(winston.transports.Console);
  });

  it('should use both file and stdout when LOG_OUTPUT is file+console', () => {
    process.env.LOG_OUTPUT = 'file+console';
    process.env.LOG_FILE = 'test.log';

    const testLogger = createLogger();

    expect(testLogger.transports).toHaveLength(2);
    expect(testLogger.transports[0]).toBeInstanceOf(winston.transports.File);
    expect(testLogger.transports[1]).toBeInstanceOf(winston.transports.Console);
    expect((testLogger.transports[0] as winston.transports.FileTransportInstance).filename).toBe('test.log');
  });

  it('should use both file and stdout when LOG_OUTPUT is file+stdout', () => {
    process.env.LOG_OUTPUT = 'file+stdout';

    const testLogger = createLogger();

    expect(testLogger.transports).toHaveLength(2);
    expect(testLogger.transports[0]).toBeInstanceOf(winston.transports.File);
    expect(testLogger.transports[1]).toBeInstanceOf(winston.transports.Console);
  });

  it('should use both file and stderr when LOG_OUTPUT is file+stderr', () => {
    process.env.LOG_OUTPUT = 'file+stderr';
    process.env.LOG_FILE = 'combined.log';

    const testLogger = createLogger();

    expect(testLogger.transports).toHaveLength(2);
    expect(testLogger.transports[0]).toBeInstanceOf(winston.transports.File);
    expect(testLogger.transports[1]).toBeInstanceOf(winston.transports.Console);
    expect((testLogger.transports[0] as winston.transports.FileTransportInstance).filename).toBe('combined.log');
    const stderrLevels = (testLogger.transports[1] as winston.transports.ConsoleTransportInstance).stderrLevels;
    expect(stderrLevels).toBeDefined();
    expect(stderrLevels).toHaveProperty('error');
    expect(stderrLevels).toHaveProperty('warn');
  });

  it('should have no transports when LOG_OUTPUT is disabled', () => {
    process.env.LOG_OUTPUT = 'disabled';

    const testLogger = createLogger();

    expect(testLogger.transports).toHaveLength(0);
  });

  it('should default to info log level', () => {
    delete process.env.LOG_LEVEL;

    const testLogger = createLogger();

    expect(testLogger.level).toBe('info');
  });

  it('should respect custom log level', () => {
    process.env.LOG_LEVEL = 'debug';

    const testLogger = createLogger();

    expect(testLogger.level).toBe('debug');
  });

  it('should handle case-insensitive LOG_OUTPUT values', () => {
    process.env.LOG_OUTPUT = 'CONSOLE';

    const testLogger = createLogger();

    expect(testLogger.transports).toHaveLength(1);
    expect(testLogger.transports[0]).toBeInstanceOf(winston.transports.Console);
  });
});
