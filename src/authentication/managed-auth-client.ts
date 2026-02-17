import axios, { AxiosInstance, AxiosProxyConfig } from 'axios';
import { logger } from '../utils/logger';
import { ManagedEnvironmentConfig } from '../utils/environment';

const MANAGED_API_SCOPES = [
  'DataExport', // Read metrics and topology
  'ReadConfig', // Read configuration and cluster version
  'ReadSyntheticData', // Read synthetic monitoring data
  'ReadLogContent', // Read log content
  'ReadEvents', // Read events
  'ReadProblems', // Read problems and root cause analysis
  'ReadSecurityProblems', // Read security problems
  'ReadSLO', // Read Service Level Objectives
];

export interface ClusterVersion {
  version: string;
}

export interface ManagedAuthClientParams {
  apiBaseUrl: string;
  dashboardBaseUrl: string;
  apiToken: string;
  alias: string;
  httpProxy?: string;
  httpsProxy?: string;
  isValid?: boolean;
  minimum_version: string;
}

export class ManagedAuthClientManager {
  public readonly rawClients: ManagedAuthClient[];
  public clients: ManagedAuthClient[];
  public validAliases: string[] = [];
  public readonly MINIMUM_VERSION = '1.328.0';

  constructor(managedEnvironments: ManagedEnvironmentConfig[]) {
    this.rawClients = [];
    this.clients = [];
    this.validAliases = ['ALL_ENVIRONMENTS'];

    logger.warn('Validating Environments');
    for (let managedEnvironment of managedEnvironments) {
      let newClient = new ManagedAuthClient({
        apiBaseUrl: managedEnvironment.apiUrl,
        dashboardBaseUrl: managedEnvironment.dashboardUrl,
        apiToken: managedEnvironment.apiToken,
        alias: managedEnvironment.alias,
        httpProxy: managedEnvironment.httpProxy,
        httpsProxy: managedEnvironment.httpsProxy,
        minimum_version: this.MINIMUM_VERSION,
      });
      this.rawClients.push(newClient);
    }
  }

  async makeRequests(endpoint: string, params: Record<string, any>, environments: string): Promise<Map<string, any>> {
    const selectedAliases = environments === 'ALL_ENVIRONMENTS' ? this.validAliases : environments.split(';');
    let responses = new Map<string, any>();
    for (const client of this.clients) {
      if (selectedAliases.indexOf(client.alias) > -1) {
        const response = await client.makeRequest(endpoint, params);
        responses.set(client.alias, response);
      }
    }
    return responses;
  }

  async isConfigured(): Promise<void> {
    for (let client of this.rawClients) {
      let validClient = await client.isConfigured();
      if (validClient) {
        client.isValid = true;
        this.clients.push(client);
        this.validAliases.push(client.alias);
      }
    }
  }

  getBaseUrl(alias: string): string {
    for (let client of this.clients) {
      if (client.alias === alias) {
        return client.dashboardBaseUrl;
      }
    }
    return '';
  }
}

export class ManagedAuthClient {
  public apiBaseUrl: string;
  public dashboardBaseUrl: string;
  public alias: string;
  public isValid: boolean;
  public validationError: string;
  private proxy: AxiosProxyConfig | undefined;
  private httpClient: AxiosInstance;
  public MINIMUM_VERSION: string;

  constructor(params: ManagedAuthClientParams) {
    this.apiBaseUrl = params.apiBaseUrl;
    this.dashboardBaseUrl = params.dashboardBaseUrl;
    this.alias = params.alias;
    this.proxy = setAxiosProxy(params.httpProxy, params.httpsProxy);
    this.isValid = params.isValid ? params.isValid : false;
    this.MINIMUM_VERSION = params.minimum_version;
    this.validationError = '';

    this.httpClient = axios.create({
      baseURL: this.apiBaseUrl,
      headers: {
        'Authorization': `Api-Token ${params.apiToken}`,
        'Content-Type': 'application/json',
        'Connection': 'close',
      },
      timeout: 30000,
      maxRedirects: 0,
    });
  }

  async validateConnection(): Promise<boolean> {
    try {
      // Try cluster version endpoint for Managed environments
      const response = await this.httpClient.get('/api/v1/config/clusterversion');
      return response.status === 200;
    } catch (error) {
      logger.error(
        `[Alias: ${this.alias}] Failed calling /api/v1/config/clusterversion; falling back to /api/v2/metrics`,
        { error: error },
      );
      // Fallback: try a basic API endpoint that exists in both SaaS and Managed
      try {
        const response = await this.httpClient.get('/api/v2/metrics', { params: { pageSize: 1 } });
        return response.status === 200;
      } catch (fallbackError) {
        logger.error(`[Alias: ${this.alias}] Failed calling /api/v2/metrics`, { error: fallbackError });
        return false;
      }
    }
  }

  async getClusterVersion(): Promise<ClusterVersion> {
    // Try cluster version endpoint for Managed environments
    try {
      const response = await this.httpClient.get('/api/v1/config/clusterversion');
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        logger.warn(
          `[Alias: ${this.alias}] No permission for /api/v1/config/clusterversion; using minimum version ${this.MINIMUM_VERSION}`,
        );
        return { version: this.MINIMUM_VERSION };
      }
      throw error;
    }
  }

  validateMinimumVersion(clusterVersion: ClusterVersion): boolean {
    const version = clusterVersion.version;

    // Compare version strings (e.g., "1.320.0" >= "1.320")
    const versionParts = version.split('.').map(Number);
    const minVersionParts = this.MINIMUM_VERSION.split('.').map(Number);

    for (let i = 0; i < Math.max(versionParts.length, minVersionParts.length); i++) {
      const current = versionParts[i] || 0;
      const minimum = minVersionParts[i] || 0;

      if (current > minimum) return true;
      if (current < minimum) return false;
    }

    return true; // Equal versions
  }

  cleanup(): void {
    // Destroy the axios instance to close connections
    if (this.httpClient) {
      // Clear interceptors
      this.httpClient.interceptors.request.clear();
      this.httpClient.interceptors.response.clear();

      // Set very short timeout to force connection closure
      this.httpClient.defaults.timeout = 1;

      // Clear the instance
      (this.httpClient as any) = null;
    }
  }

  async makeRequest(endpoint: string, params?: Record<string, any>): Promise<any> {
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const response = await this.httpClient.get(url, {
      proxy: this.proxy ?? undefined,
      params: params || {},
    });
    return response.data;
  }

  async isConfigured() {
    // Test connection to Managed cluster
    logger.info(`Testing connection to Dynatrace Managed environment "${this.alias}": ${this.apiBaseUrl}...`);
    try {
      const isConnected = await this.validateConnection();
      if (!isConnected) {
        //throw new Error('Connection validation failed'); // CANT CONNECT
        this.validationError = "Connection validation failed: Can't connect to environment " + this.alias;
        return false;
      }
      logger.info(`Called validateConnection`);

      const clusterVersion = await this.getClusterVersion();
      logger.info(`Connected to Managed cluster version ${clusterVersion.version}`);

      const isValidVersion = this.validateMinimumVersion(clusterVersion);
      if (!isValidVersion) {
        const invalidVersionMessage = `Environment "${this.alias}" version ${clusterVersion.version} may not support all features. Minimum recommended version is ${this.MINIMUM_VERSION}`;
        logger.info(invalidVersionMessage);
        this.validationError = invalidVersionMessage;
        return false;
      }
      return true;
    } catch (error: any) {
      logger.error(
        `[CONNECTION ERROR] Failed to connect to Managed environment "${this.alias}": ${this.apiBaseUrl}: ${error.message}.`,
      );
      logger.error('Please verify:');
      logger.error('1. DT_ENVIRONMENT_CONFIGS is correct');
      logger.error(`2. API Token has required scopes: ${MANAGED_API_SCOPES.join(', ')}`);
      logger.error('3. Network connectivity to the Managed environment');
      this.validationError = `Failed to connect to Managed environment "${this.alias}": ${this.apiBaseUrl}: ${error.message}. Please verify connection details are correct.`;
      return false;
    }
  }
}

export function setAxiosProxy(httpProxy = '', httpsProxy = ''): AxiosProxyConfig | undefined {
  if (httpsProxy && httpProxy) {
    logger.error('Cannot specify both HTTPS_PROXY and HTTP_PROXY, use only one.');
    return undefined;
  } else if (!httpsProxy && !httpProxy) {
    // No proxy configured, nothing to do
    return undefined;
  }

  try {
    let url: URL;
    let port: string;
    let protocol: string;

    if (httpsProxy) {
      url = new URL(httpsProxy);
      port = url.port ? url.port : '443';
      protocol = url.protocol ? url.protocol : 'https';
    } else if (httpProxy) {
      url = new URL(httpProxy);
      port = url.port ? url.port : '80';
      protocol = url.protocol ? url.protocol : 'http';
    } else {
      // No proxy configured, nothing to do
      return undefined;
    }

    logger.info(`Configuring HTTP Proxy for Axios client: ${url.hostname}:${port}`);

    return {
      host: url.hostname,
      port: Number(port),
      protocol: protocol,
      auth: url.username
        ? { username: decodeURIComponent(url.username), password: decodeURIComponent(url.password) }
        : undefined,
    };
  } catch (err: any) {
    logger.error(`Failed to configure HTTP Proxy for Axios client: ${err.message}`);
    throw Error('Failed to parse and configure http(s) proxy', { cause: err });
  }
}
