import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { JSONObject } from '@dynatrace/openkit-js';
import { logger } from './logger';

/**
 * Raw configuration structure as defined in config files
 * (before being parsed into ManagedEnvironmentConfig)
 */
export interface DynatraceEnvironmentConfig {
  apiEndpointUrl: string;
  environmentId: string;
  alias: string;
  apiToken: string;
  dynatraceUrl?: string;
  httpProxyUrl?: string;
  httpsProxyUrl?: string;
}

/**
 * Matches a ${VAR_NAME} placeholder.
 */
const ENV_VAR_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)}/g;

/**
 * Load configuration from a file (JSON or YAML)
 * Returns JSONObject[] for compatibility with existing parsing logic
 */
export function loadFromFile(filePath: string, requireToken = true): JSONObject[] {
  logger.debug(`Loading configuration from file: ${filePath}`);

  // Resolve path (handle ~, relative, absolute, env vars)
  const resolvedPath = resolvePath(filePath);
  logger.debug(`Resolved path: ${resolvedPath}`);

  // Check file exists
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Configuration file not found: ${resolvedPath}\n` +
        `Original path: ${filePath}\n` +
        `Make sure the path is correct and the file exists.`,
    );
  }

  // Read file
  let fileContent = fs.readFileSync(resolvedPath, 'utf-8');
  logger.debug(`File content length: ${fileContent.length} bytes`);

  // INTERPOLATE ENVIRONMENT VARIABLES BEFORE PARSING
  // Supports: ${VAR_NAME} syntax
  fileContent = interpolateEnvVars(fileContent);

  // Detect format and parse
  const ext = path.extname(resolvedPath).toLowerCase();
  let config: unknown;

  try {
    if (ext === '.json') {
      logger.debug('Parsing as JSON');
      config = JSON.parse(fileContent);
    } else if (ext === '.yaml' || ext === '.yml') {
      logger.debug('Parsing as YAML');
      config = yaml.load(fileContent);
    } else {
      throw new Error(`Unsupported file format: ${ext}\n` + `Supported formats: .json, .yaml, .yml`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${ext} file: ${resolvedPath}\n` + `Error: ${message}`, {
      cause: error,
    });
  }

  // Validate structure
  if (!Array.isArray(config)) {
    throw new TypeError(`Configuration must be an array of environments.\n` + `File: ${resolvedPath}`);
  }

  if (!Number.isInteger(config.length)) {
    throw new TypeError('Configuration length parameter is not a number');
  }

  // Should SonarQube return an error here because of "Confidential data should not be logged" ignore it
  // There are 2 assertions to ensure that config.length contains no confidential information
  logger.info(`Successfully loaded ${config.length} environment(s) from ${filePath}`);

  // Validate each environment config
  return validateAndReturnConfig(config, resolvedPath, requireToken);
}

/**
 * Interpolate environment variables in file content
 * Supports: ${VAR_NAME} syntax
 */
function interpolateEnvVars(content: string): string {
  // Replace ${VAR_NAME} with env var value
  return content.replace(ENV_VAR_PATTERN, (match, varName) => {
    const value = process.env[varName];

    if (value === undefined) {
      throw new Error(
        `Environment variable not found: ${varName}\n` +
          `Referenced as: ${match}\n` +
          `Make sure ${varName} is set in your environment.`,
      );
    }

    logger.debug(`Interpolated ${match} -> [REDACTED]`);
    return value;
  });
}

/**
 * Resolve path with cross-platform support
 */
function resolvePath(filePath: string): string {
  // Expand environment variables in path (e.g., ${HOME}/config.json)
  let resolved = filePath.replace(ENV_VAR_PATTERN, (match, varName) => {
    const value = process.env[varName];
    if (value === undefined) {
      throw new Error(
        `Environment variable not found: ${varName}\n` +
          `Referenced as: ${match}\n` +
          `Make sure ${varName} is set in your environment.`,
      );
    }
    return value;
  });

  // Expand ~ to home directory
  if (resolved.startsWith('~')) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (!homeDir) {
      throw new Error('Cannot expand ~: HOME/USERPROFILE environment variable not set');
    }
    resolved = resolved.replace('~', homeDir);
  }

  // Resolve relative paths
  if (!path.isAbsolute(resolved)) {
    resolved = path.resolve(process.cwd(), resolved);
  }

  return resolved;
}

/**
 * Validate configuration structure and required fields
 */
function validateAndReturnConfig(config: unknown[], filePath: string, requireToken = true): JSONObject[] {
  // Validate required fields
  const required = requireToken
    ? ['apiEndpointUrl', 'environmentId', 'alias', 'apiToken']
    : ['apiEndpointUrl', 'environmentId', 'alias'];

  config.forEach((env, index) => {
    if (typeof env !== 'object' || env === null) {
      throw new Error(`Environment #${index + 1} in ${filePath} must be an object.`);
    }
    const fields = env as Record<string, unknown>;
    const missing = required.filter((field) => !fields[field]);
    if (missing.length > 0) {
      throw new Error(
        `Environment #${index + 1} in ${filePath} is missing required fields: ${missing.join(', ')}\n` +
          `Found fields: ${Object.keys(env).join(', ')}`,
      );
    }
  });

  // Cast to JSONObject[] for compatibility with existing parsing logic
  return config as JSONObject[];
}
