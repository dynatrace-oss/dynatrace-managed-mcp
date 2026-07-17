import { JSONObject } from '@dynatrace/openkit-js';
import { logErrorObject, logger } from './logger';
import { loadFromFile } from './config-loader';

export interface ManagedEnvironmentConfig {
  environmentId: string;
  apiUrl: string;
  dashboardUrl: string;
  apiToken: string;
  alias: string;
  httpProxy?: string;
  httpsProxy?: string;
}

export function parseManagedEnvironmentConfig(environmentInfo: JSONObject): ManagedEnvironmentConfig {
  const environmentIdRaw = environmentInfo.environmentId ? environmentInfo.environmentId.toString() : '';
  const apiUrlRaw = environmentInfo.apiEndpointUrl ? environmentInfo.apiEndpointUrl.toString() : '';
  const dashboardUrlRaw = environmentInfo.dynatraceUrl ? environmentInfo.dynatraceUrl.toString() : '';
  const apiToken = environmentInfo.apiToken ? environmentInfo.apiToken.toString() : '';
  const alias = environmentInfo.alias ? environmentInfo.alias.toString() : '';
  const httpProxy = environmentInfo.httpProxyUrl ? environmentInfo.httpProxyUrl.toString() : '';
  const httpsProxy = environmentInfo.httpsProxyUrl ? environmentInfo.httpsProxyUrl.toString() : '';

  const environmentId = environmentIdRaw.replace(/\/$/, ''); // Remove trailing slash
  let apiUrl = '';
  if (apiUrlRaw != '') {
    apiUrl = apiUrlRaw + (apiUrlRaw.endsWith('/') ? '' : '/') + 'e/' + environmentId;
  }
  let dashboardUrl = dashboardUrlRaw ? dashboardUrlRaw : apiUrlRaw;
  dashboardUrl = dashboardUrl + (dashboardUrl.endsWith('/') ? '' : '/') + 'e/' + environmentId;

  return {
    environmentId: environmentId,
    apiUrl: apiUrl,
    dashboardUrl: dashboardUrl,
    apiToken: apiToken,
    alias: alias,
    httpProxy: httpProxy,
    httpsProxy: httpsProxy,
  };
}

export function getManagedEnvironmentConfigs(requireToken = true): ManagedEnvironmentConfig[] {
  // Priority 1: DT_CONFIG_FILE - Load from external file (JSON or YAML)
  if (process.env.DT_CONFIG_FILE) {
    logger.info(`Loading configuration from file: ${process.env.DT_CONFIG_FILE}`);

    // Warn if both methods are set
    if (process.env.DT_ENVIRONMENT_CONFIGS) {
      logger.warn(
        'Both DT_CONFIG_FILE and DT_ENVIRONMENT_CONFIGS are set. ' + 'Using DT_CONFIG_FILE (higher priority).',
      );
    }

    try {
      const environmentConfigurations = loadFromFile(process.env.DT_CONFIG_FILE, requireToken);
      const parsedManagedEnvironmentConfigs: ManagedEnvironmentConfig[] = [];
      for (const environmentConfig of environmentConfigurations) {
        parsedManagedEnvironmentConfigs.push(parseManagedEnvironmentConfig(environmentConfig));
      }
      return parsedManagedEnvironmentConfigs;
    } catch (error) {
      logErrorObject(error, 'Failed to load configuration file');
      throw error;
    }
  }

  // Priority 2: DT_ENVIRONMENT_CONFIGS - Parse JSON string
  // Unlike the DT_CONFIG_FILE path (which validates required fields up front in the loader,
  // honoring requireToken), this branch performs no early structural check. Field-presence
  // validation - including apiToken when requireToken is true - is enforced downstream by
  // validateEnvironments(configs, requireToken), which the server always calls after loading.
  const environmentConfigs = process.env.DT_ENVIRONMENT_CONFIGS;
  if (environmentConfigs) {
    logger.info('Loading configuration from DT_ENVIRONMENT_CONFIGS');
    let environmentConfigurations;
    try {
      environmentConfigurations = JSON.parse(environmentConfigs);
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error('JSON syntax error in environment file', { cause: e });
      } else {
        throw e;
      }
    }
    const parsedManagedEnvironmentConfigs: ManagedEnvironmentConfig[] = [];
    for (const environmentConfig of environmentConfigurations) {
      parsedManagedEnvironmentConfigs.push(parseManagedEnvironmentConfig(environmentConfig));
    }
    return parsedManagedEnvironmentConfigs;
  }

  // Neither provided - helpful error message
  throw new Error(
    'Configuration not found. Please set one of:\n' +
      '  - DT_CONFIG_FILE: Path to config file (JSON or YAML)\n' +
      '  - DT_ENVIRONMENT_CONFIGS: JSON string\n\n' +
      'Example with file:\n' +
      '  DT_CONFIG_FILE=./dt-config.yaml\n\n' +
      'Example with JSON string:\n' +
      '  DT_ENVIRONMENT_CONFIGS=\'[{"apiEndpointUrl":"...","environmentId":"..."}]\'\n\n' +
      'See documentation: https://github.com/dynatrace-oss/dynatrace-managed-mcp#configuration',
  );
}

export function validateEnvironments(
  environmentConfigurations: ManagedEnvironmentConfig[],
  requireToken = true,
): {
  valid_configs: ManagedEnvironmentConfig[];
  errors: string[];
} {
  const requiredKeys = requireToken
    ? ['apiUrl', 'environmentId', 'alias', 'apiToken']
    : ['apiUrl', 'environmentId', 'alias'];
  const originalKeys = {
    apiUrl: 'apiEndpointUrl',
    environmentId: 'environmentId',
    alias: 'alias',
    apiToken: 'apiToken',
  };
  const validConfigurations: ManagedEnvironmentConfig[] = [];
  const errors: string[] = [];

  environmentConfigurations.forEach((configuration, index) => {
    const hasAllValues = requiredKeys.every((key) => {
      const value = configuration[key as keyof typeof configuration];

      const isValid = value && value.length > 0;
      if (!isValid) {
        errors.push(
          `Key "${originalKeys[key as keyof typeof originalKeys]}" is empty or missing (environment #${index}, alias: ${configuration.alias ? configuration.alias : 'N/A'}). Please make sure all values are present and populated in the configuration array.`,
        );
      }
      return isValid;
    });
    const validAlias = configuration.alias.indexOf(';') == -1;
    if (!validAlias) {
      errors.push(
        'Invalid alias found: "' + configuration.alias + '". Aliases are mandatory and cannot contain semicolons.',
      );
    }
    if (validAlias && hasAllValues) {
      validConfigurations.push(configuration);
    }
  });

  return { valid_configs: validConfigurations, errors: errors };
}

/** Build the alias -> token map from config (stdio mode, once at startup). */
export function buildConfigTokenMap(configs: ManagedEnvironmentConfig[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const config of configs) {
    if (config.apiToken) {
      map.set(config.alias, config.apiToken);
    }
  }
  return map;
}
