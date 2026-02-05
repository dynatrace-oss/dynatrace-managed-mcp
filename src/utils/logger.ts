import winston from 'winston';

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

export const logger = winston.createLogger({
  level: (process.env.LOG_LEVEL || 'info').toLowerCase(),
  format: createFormat(),
  transports: createTransports(),
});

export async function flushLogger() {
  logger.end();
  await new Promise((resolve) => logger.once('finish', resolve));
}
