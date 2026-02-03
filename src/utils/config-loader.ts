import * as fs from 'fs';
import * as path from 'path';
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

export class ConfigFileLoader {
  /**
   * Load configuration from a file (JSON or YAML)
   * Returns JSONObject[] for compatibility with existing parsing logic
   */
  static loadFromFile(filePath: string): JSONObject[] {
    logger.debug(`Loading configuration from file: ${filePath}`);

    // Resolve path (handle ~, relative, absolute, env vars)
    const resolvedPath = this.resolvePath(filePath);
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
    fileContent = this.interpolateEnvVars(fileContent);

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
    } catch (error: any) {
      throw new Error(`Failed to parse ${ext} file: ${resolvedPath}\n` + `Error: ${error.message}`);
    }

    // Validate structure
    if (!Array.isArray(config)) {
      throw new Error(`Configuration must be an array of environments.\n` + `File: ${resolvedPath}`);
    }

    logger.info(`Successfully loaded ${config.length} environment(s) from ${resolvedPath}`);

    // Validate each environment config
    return this.validateAndReturnConfig(config, resolvedPath);
  }

  /**
   * Interpolate environment variables in file content
   * Supports: ${VAR_NAME} syntax
   */
  private static interpolateEnvVars(content: string): string {
    // Replace ${VAR_NAME} with env var value
    return content.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (match, varName) => {
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
  private static resolvePath(filePath: string): string {
    // Expand environment variables in path (e.g., ${HOME}/config.json)
    let resolved = filePath.replace(/\$\{(\w+)\}/g, (_, varName) => {
      const value = process.env[varName];
      if (!value) {
        logger.warn(`Environment variable ${varName} not found in path, using empty string`);
        return '';
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
  private static validateAndReturnConfig(config: any[], filePath: string): JSONObject[] {
    // Validate required fields
    const required = ['apiEndpointUrl', 'environmentId', 'alias', 'apiToken'];

    config.forEach((env, index) => {
      const missing = required.filter((field) => !env[field]);
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
}
