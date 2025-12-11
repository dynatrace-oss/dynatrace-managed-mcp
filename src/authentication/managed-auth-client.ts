import axios, { AxiosInstance, AxiosProxyConfig } from 'axios';
import { logger } from '../utils/logger';

export interface ClusterVersion {
  version: string;
}

export class ManagedAuthClient {
  private proxy: AxiosProxyConfig | undefined;
  private httpClient: AxiosInstance;
  public readonly MINIMUM_VERSION = '1.328.0';

  constructor(
    public baseUrl: string,
    private apiToken: string,
  ) {
    this.proxy = getAxiosProxyFromEnv();

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Api-Token ${this.apiToken}`,
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
      logger.error('Failed calling /api/v1/config/clusterversion; falling back to /api/v2/metrics', { error: error });
      // Fallback: try a basic API endpoint that exists in both SaaS and Managed
      try {
        const response = await this.httpClient.get('/api/v2/metrics', { params: { pageSize: 1 } });
        return response.status === 200;
      } catch (fallbackError) {
        logger.error('Failed calling /api/v2/metrics', { error: fallbackError });
        return false;
      }
    }
  }

  async getClusterVersion(): Promise<ClusterVersion> {
    // Try cluster version endpoint for Managed environments
    const response = await this.httpClient.get('/api/v1/config/clusterversion');
    return response.data;
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

  getHttpClient(): AxiosInstance {
    return this.httpClient;
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
}

export function getAxiosProxyFromEnv(): AxiosProxyConfig | undefined {
  const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY;
  const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY;

  if (httpsProxy && httpProxy) {
    throw Error('Cannot specify both HTTPS_PROXY and HTTP_PROXY, use only one.');
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
