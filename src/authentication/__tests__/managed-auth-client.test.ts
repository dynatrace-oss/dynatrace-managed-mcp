import {
  ManagedAuthClient,
  ManagedAuthClientManager,
  MissingTokenError,
  buildManagedAuthClients,
  validateManagedClients,
} from '../managed-auth-client';
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// axios is auto-mocked above, so axios.AxiosError/AxiosHeaders are mock stand-ins whose constructors
// don't run real logic. Build a plain object shaped like an AxiosError instead of instantiating them.
function buildAxiosError(status: number): AxiosError {
  const config = {} as InternalAxiosRequestConfig;
  const response: AxiosResponse = {
    status,
    statusText: 'Forbidden',
    headers: {},
    data: {},
    config,
  };

  return {
    name: 'AxiosError',
    message: `Request failed with status code ${status}`,
    isAxiosError: true,
    toJSON: () => ({}),
    config,
    response,
  } as unknown as AxiosError;
}

describe('ManagedAuthClient', () => {
  let client: ManagedAuthClient;
  const mockCreate = jest.fn();

  beforeEach(() => {
    mockedAxios.create = mockCreate;
    // axios.isAxiosError is auto-mocked too; give it a real implementation matching the
    // isAxiosError: true marker that buildAxiosError sets, so production code's type guard works.
    mockedAxios.isAxiosError.mockImplementation(
      (error: unknown): error is AxiosError =>
        typeof error === 'object' && error !== null && (error as { isAxiosError?: boolean }).isAxiosError === true,
    );
    mockCreate.mockReturnValue({ get: jest.fn() });
    client = new ManagedAuthClient({
      apiBaseUrl: 'https://managed.test.com',
      dashboardBaseUrl: 'https://managed-dashboard.test.com',
      alias: 'testAlias',
      minimum_version: '1.328.0',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates the axios instance without a baked-in Authorization header', () => {
      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: 'https://managed.test.com',
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'close',
        },
        timeout: 30000,
        maxRedirects: 0,
      });
    });
  });

  describe('makeRequest', () => {
    it('sets a per-call Authorization header from the supplied token', async () => {
      const mockGet = jest.fn().mockResolvedValue({ data: { ok: true } });
      mockCreate.mockReturnValue({ get: mockGet });
      client = new ManagedAuthClient({
        apiBaseUrl: 'https://managed.test.com',
        dashboardBaseUrl: 'https://managed-dashboard.test.com',
        alias: 'testAlias',
        minimum_version: '1.328.0',
      });

      const data = await client.makeRequest('/api/v2/metrics', 'token-A', {});

      expect(data).toEqual({ ok: true });
      expect(mockGet).toHaveBeenCalledWith('/api/v2/metrics', {
        proxy: undefined,
        params: {},
        headers: { Authorization: 'Api-Token token-A' },
      });
    });

    it('uses a different Authorization per call (no cross-contamination)', async () => {
      const mockGet = jest.fn().mockResolvedValue({ data: {} });
      mockCreate.mockReturnValue({ get: mockGet });
      client = new ManagedAuthClient({
        apiBaseUrl: 'https://managed.test.com',
        dashboardBaseUrl: 'https://managed-dashboard.test.com',
        alias: 'testAlias',
        minimum_version: '1.328.0',
      });

      await client.makeRequest('/x', 'token-A');
      await client.makeRequest('/x', 'token-B');

      expect(mockGet.mock.calls[0][1].headers).toEqual({ Authorization: 'Api-Token token-A' });
      expect(mockGet.mock.calls[1][1].headers).toEqual({ Authorization: 'Api-Token token-B' });
    });
  });

  describe('validateConnection', () => {
    it('tries the cluster version endpoint first, then falls back, sending the token both times', async () => {
      const mockGet = jest
        .fn()
        .mockRejectedValueOnce(new Error('Cluster version not available'))
        .mockResolvedValueOnce({ status: 200 });
      mockCreate.mockReturnValue({ get: mockGet });
      client = new ManagedAuthClient({
        apiBaseUrl: 'https://managed.test.com',
        dashboardBaseUrl: 'https://managed-dashboard.test.com',
        alias: 'testAlias',
        minimum_version: '1.328.0',
      });

      const result = await client.validateConnection('test-token');

      expect(result).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('/api/v1/config/clusterversion', {
        headers: { Authorization: 'Api-Token test-token' },
      });
      expect(mockGet).toHaveBeenCalledWith('/api/v2/metrics', {
        params: { pageSize: 1 },
        headers: { Authorization: 'Api-Token test-token' },
      });
    });
  });

  describe('validateMinimumVersion', () => {
    it('returns true for version above minimum', () => {
      expect(client.validateMinimumVersion({ version: '1.329.0' })).toBe(true);
    });
    it('returns false for version below minimum', () => {
      expect(client.validateMinimumVersion({ version: '1.319.0' })).toBe(false);
    });
    it('returns true for the exact minimum version', () => {
      expect(client.validateMinimumVersion({ version: '1.328.0' })).toBe(true);
    });
  });

  describe('getClusterVersion', () => {
    it('returns the minimum version when clusterversion is forbidden', async () => {
      const rej = buildAxiosError(403);
      const mockGet = jest.fn().mockRejectedValueOnce(rej);
      mockCreate.mockReturnValue({ get: mockGet });
      client = new ManagedAuthClient({
        apiBaseUrl: 'https://managed.test.com',
        dashboardBaseUrl: 'https://managed-dashboard.test.com',
        alias: 'testAlias',
        minimum_version: '1.328.0',
      });

      const result = await client.getClusterVersion('test-token');

      expect(result).toEqual({ version: '1.328.0' });
      expect(mockGet).toHaveBeenCalledWith('/api/v1/config/clusterversion', {
        headers: { Authorization: 'Api-Token test-token' },
      });
    });
  });
});

describe('ManagedAuthClientManager', () => {
  function fakeClient(alias: string): ManagedAuthClient {
    return {
      alias,
      dashboardBaseUrl: `https://dash.${alias}.test`,
      makeRequest: jest.fn().mockResolvedValue({ ok: alias }),
    } as unknown as ManagedAuthClient;
  }

  it('routes a request to the matching client with that alias token', async () => {
    const prod = fakeClient('prod');
    const staging = fakeClient('staging');
    const mgr = new ManagedAuthClientManager(
      [prod, staging],
      [prod, staging],
      ['ALL_ENVIRONMENTS', 'prod', 'staging'],
      new Map([
        ['prod', 'tok-prod'],
        ['staging', 'tok-staging'],
      ]),
    );

    const res = await mgr.makeRequests('/api/x', { a: 1 }, 'prod');

    expect(prod.makeRequest).toHaveBeenCalledWith('/api/x', 'tok-prod', { a: 1 });
    expect(staging.makeRequest).not.toHaveBeenCalled();
    expect(res.get('prod')).toEqual({ ok: 'prod' });
  });

  it('throws MissingTokenError when no token is supplied for the requested alias', async () => {
    const prod = fakeClient('prod');
    const mgr = new ManagedAuthClientManager([prod], [prod], ['ALL_ENVIRONMENTS', 'prod'], new Map());

    await expect(mgr.makeRequests('/api/x', {}, 'prod')).rejects.toBeInstanceOf(MissingTokenError);
    await expect(mgr.makeRequests('/api/x', {}, 'prod')).rejects.toThrow(/Add `prod=<token>`/);
  });

  it('ALL_ENVIRONMENTS targets only the environments the caller has tokens for', async () => {
    const prod = fakeClient('prod');
    const staging = fakeClient('staging');
    const mgr = new ManagedAuthClientManager(
      [prod, staging],
      [prod, staging],
      ['ALL_ENVIRONMENTS', 'prod', 'staging'],
      new Map([['prod', 'tok-prod']]),
    );

    const res = await mgr.makeRequests('/api/x', {}, 'ALL_ENVIRONMENTS');

    expect(prod.makeRequest).toHaveBeenCalled();
    expect(staging.makeRequest).not.toHaveBeenCalled();
    expect([...res.keys()]).toEqual(['prod']);
  });

  it('getBaseUrl returns the dashboard URL for an alias', () => {
    const prod = fakeClient('prod');
    const mgr = new ManagedAuthClientManager([prod], [prod], ['ALL_ENVIRONMENTS', 'prod'], new Map());
    expect(mgr.getBaseUrl('prod')).toBe('https://dash.prod.test');
    expect(mgr.getBaseUrl('nope')).toBe('');
  });

  it('tokenFor returns the caller token for an alias', () => {
    const prod = fakeClient('prod');
    const mgr = new ManagedAuthClientManager([prod], [prod], ['ALL_ENVIRONMENTS', 'prod'], new Map([['prod', 't']]));
    expect(mgr.tokenFor('prod')).toBe('t');
    expect(mgr.tokenFor('missing')).toBeUndefined();
  });

  it('throws MissingTokenError for a specific alias the caller has no token for', async () => {
    const prod = fakeClient('prod');
    const staging = fakeClient('staging');
    const mgr = new ManagedAuthClientManager(
      [prod, staging],
      [prod, staging],
      ['ALL_ENVIRONMENTS', 'prod', 'staging'],
      new Map([['staging', 't']]),
    );
    await expect(mgr.makeRequests('/x', {}, 'prod')).rejects.toBeInstanceOf(MissingTokenError);
    expect(prod.makeRequest).not.toHaveBeenCalled();
  });
});

describe('buildManagedAuthClients', () => {
  const mockCreate = jest.fn();
  beforeEach(() => {
    mockedAxios.create = mockCreate;
    mockCreate.mockReturnValue({ get: jest.fn() });
  });
  afterEach(() => jest.clearAllMocks());

  it('builds one token-less client per config with mapped url/alias fields', () => {
    const clients = buildManagedAuthClients([
      {
        alias: 'prod',
        apiUrl: 'https://prod-api/e/abc',
        dashboardUrl: 'https://prod-dash/e/abc',
        environmentId: 'abc',
        apiToken: 'ignored-in-build',
        httpProxy: '',
        httpsProxy: '',
      },
    ]);
    expect(clients).toHaveLength(1);
    expect(clients[0].alias).toBe('prod');
    expect(clients[0].apiBaseUrl).toBe('https://prod-api/e/abc');
    expect(clients[0].dashboardBaseUrl).toBe('https://prod-dash/e/abc');
  });
});

describe('validateManagedClients', () => {
  function fakeAuthClient(alias: string, ok: boolean) {
    return { alias, isValid: false, isConfigured: jest.fn().mockResolvedValue(ok) } as unknown as ManagedAuthClient;
  }

  it('includes reachable clients (sets isValid) and excludes unreachable ones', async () => {
    const good = fakeAuthClient('prod', true);
    const bad = fakeAuthClient('staging', false);
    const { validClients, validAliases } = await validateManagedClients(
      [good, bad],
      new Map([
        ['prod', 't1'],
        ['staging', 't2'],
      ]),
    );
    expect(good.isConfigured).toHaveBeenCalledWith('t1');
    expect(bad.isConfigured).toHaveBeenCalledWith('t2');
    expect(good.isValid).toBe(true);
    expect(validClients).toEqual([good]);
    expect(validAliases).toEqual(['ALL_ENVIRONMENTS', 'prod']);
  });

  it('skips clients with no token without calling isConfigured', async () => {
    const noToken = fakeAuthClient('prod', true);
    const { validClients, validAliases } = await validateManagedClients([noToken], new Map());
    expect(noToken.isConfigured).not.toHaveBeenCalled();
    expect(validClients).toEqual([]);
    expect(validAliases).toEqual(['ALL_ENVIRONMENTS']);
  });
});
