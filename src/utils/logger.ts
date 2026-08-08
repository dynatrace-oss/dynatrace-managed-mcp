import winston from 'winston';
import axios from 'axios';

export const sanitizeErrors = winston.format((info) => {
  // In case AxiosError is passed as sole message object
  if (axios.isAxiosError(info)) {
    delete info.config;
    delete info.request;
    delete info.response;
    return info;
  }
  for (const key of Object.keys(info)) {
    if (info[key] instanceof Error) {
      info[key] = info[key].message;
    }
  }
  return info;
});

function createFormat(): winston.Logform.Format {
  const logOutput = (process.env.LOG_OUTPUT || 'file').toLowerCase();
  const useConsole = [
    'console',
    'stdout',
    'stderr',
    'stderr-all',
    'file+console',
    'file+stdout',
    'file+stderr',
  ].includes(logOutput);

  if (useConsole) {
    // Use human-readable format for console output
    return winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      sanitizeErrors(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}] ${message}${metaStr}`;
      }),
    );
  } else {
    // Use JSON format for file output
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      sanitizeErrors(),
      winston.format.json(),
    );
  }
}

function createTransports(): winston.transport[] {
  const logOutput = (process.env.LOG_OUTPUT || 'file').toLowerCase();
  const logFile = process.env.LOG_FILE || 'dynatrace-managed-mcp.log';

  switch (logOutput) {
    case 'stderr':
      // Send only errors and warnings to stderr (standard behavior)
      return [
        new winston.transports.Console({
          stderrLevels: ['error', 'warn'],
        }),
      ];
    case 'stderr-all':
      // Send all log levels to stderr
      return [
        new winston.transports.Console({
          stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
        }),
      ];
    case 'console':
    case 'stdout':
      // Send all logs to stdout
      return [new winston.transports.Console()];
    case 'file+console':
    case 'file+stdout':
      // Log to both file and stdout
      return [new winston.transports.File({ filename: logFile }), new winston.transports.Console()];
    case 'file+stderr':
      // Log to file and send errors/warnings to stderr
      return [
        new winston.transports.File({ filename: logFile }),
        new winston.transports.Console({
          stderrLevels: ['error', 'warn'],
        }),
      ];
    case 'disabled':
      return [];
    case 'file':
    default:
      return [new winston.transports.File({ filename: logFile })];
  }
}

export function createLogger(): winston.Logger {
  const logOutput = (process.env.LOG_OUTPUT || 'file').toLowerCase();
  return winston.createLogger({
    level: (process.env.LOG_LEVEL || 'info').toLowerCase(),
    silent: logOutput === 'disabled',
    format: createFormat(),
    transports: createTransports(),
  });
}

export const logger = createLogger();

function firstLine(details: string): string {
  return details.split(/\r?\n/, 1)[0] ?? '';
}

function formatErrorDetails(error: Error, firstLineOnly: boolean): string {
  if (!firstLineOnly) {
    return error.message;
  }

  const summary = firstLine(error.message);
  if (error.cause instanceof Error) {
    const causeSummary = firstLine(error.cause.message);
    if (causeSummary.startsWith('Unsupported file format:')) {
      return `${summary}: ${causeSummary}`;
    }
  }

  return summary;
}

function formatErrorObject(error: unknown, message?: string, firstLineOnly = false): string {
  const formattedMessage: string = message !== undefined && message.length > 0 ? message + ': ' : '';

  if (axios.isAxiosError(error)) {
    const formattedCode: string = error.code !== undefined && error.code.length > 0 ? error.code + ' ' : '';
    return `${formattedCode}${formattedMessage}${formatErrorDetails(error, firstLineOnly)}`;
  } else if (error instanceof Error) {
    return `${formattedMessage}${formatErrorDetails(error, firstLineOnly)}`;
  }

  return `${message}: unknown error`;
}

export function logErrorObject(error: unknown, message?: string) {
  logger.error(formatErrorObject(error, message));
}

export function logFatalErrorObject(error: unknown, message?: string) {
  logger.error(formatErrorObject(error, message));

  const logOutput = (process.env.LOG_OUTPUT || 'file').toLowerCase();
  const loggerWritesErrorsToStderr = ['stderr', 'stderr-all', 'file+stderr'].includes(logOutput);
  if (!loggerWritesErrorsToStderr) {
    // Parser errors can include configuration snippets, so only expose their first line.
    console.error(formatErrorObject(error, message, true));
  }
}

export async function flushLogger() {
  logger.end();
  await new Promise((resolve) => logger.once('finish', resolve));
}
