import { ManagedAuthClient } from '../managed-auth-client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ManagedAuthClient', () => {
  let client: ManagedAuthClient;
  const mockCreate = jest.fn();

  beforeEach(() => {
    mockedAxios.create = mockCreate;
    mockCreate.mockReturnValue({
      get: jest.fn(),
    });
    client = new ManagedAuthClient('https://managed.test.com', 'test-token');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create axios instance with correct config', () => {
      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: 'https://managed.test.com',
        headers: {
          'Authorization': 'Api-Token test-token',
          'Content-Type': 'application/json',
          'Connection': 'close',
        },
        timeout: 30000,
        maxRedirects: 0,
      });
    });
  });

  describe('validateConnection', () => {
    it('should try cluster version endpoint first, then fallback', async () => {
      const mockGet = jest
        .fn()
        .mockRejectedValueOnce(new Error('Cluster version not available'))
        .mockResolvedValueOnce({ status: 200 });
      mockCreate.mockReturnValue({ get: mockGet });
      client = new ManagedAuthClient('https://managed.test.com', 'test-token');

      const result = await client.validateConnection();

      expect(result).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('/api/v1/config/clusterversion');
      expect(mockGet).toHaveBeenCalledWith('/api/v2/metrics', { params: { pageSize: 1 } });
    });
  });

  describe('validateMinimumVersion', () => {
    it('should return true for version above minimum', () => {
      const clusterVersion = { version: '1.329.0', buildDate: '2025-11-13', buildVersion: '1.329.0.20251113-072620' };

      const result = client.validateMinimumVersion(clusterVersion);

      expect(result).toBe(true);
    });

    it('should return false for version below minimum', () => {
      const clusterVersion = { version: '1.319.0', buildDate: '2024-01-01', buildVersion: '1.319.0.123' };

      const result = client.validateMinimumVersion(clusterVersion);

      expect(result).toBe(false);
    });

    it('should return true for exact minimum version', () => {
      const clusterVersion = { version: '1.328.0', buildDate: '2024-01-01', buildVersion: '1.328.0.123' };

      const result = client.validateMinimumVersion(clusterVersion);

      expect(result).toBe(true);
    });
  });
});
