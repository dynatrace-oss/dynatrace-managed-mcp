import { ManagedAuthClient, ManagedAuthClientManager, MissingTokenError } from '../managed-auth-client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ManagedAuthClient', () => {
  let client: ManagedAuthClient;
  const mockCreate = jest.fn();

  beforeEach(() => {
    mockedAxios.create = mockCreate;
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

      const data = await client.makeRequest('/api/v2/metrics', 'token-A', { pageSize: 1 });

      expect(data).toEqual({ ok: true });
      expect(mockGet).toHaveBeenCalledWith('/api/v2/metrics', {
        proxy: undefined,
        params: { pageSize: 1 },
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
      const mockGet = jest.fn().mockRejectedValueOnce({ response: { status: 403 } });
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
  function fakeClient(alias: string) {
    return {
      alias,
      dashboardBaseUrl: `https://dash.${alias}.test`,
      makeRequest: jest.fn().mockResolvedValue({ ok: alias }),
    } as any;
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
});
