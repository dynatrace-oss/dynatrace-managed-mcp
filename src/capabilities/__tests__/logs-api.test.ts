import { LogsApiClient, LogEntry, ListLogsResponse } from '../logs-api';
import { ManagedAuthClientManager } from '../../authentication/managed-auth-client';
import { readFileSync } from 'fs';

jest.mock('../../authentication/managed-auth-client');

describe('LogsApiClient', () => {
  let mockAuthManager: jest.Mocked<ManagedAuthClientManager>;
  let client: LogsApiClient;

  beforeEach(() => {
    mockAuthManager = {
      makeRequests: jest.fn(),
      getBaseUrl: jest.fn(() => {
        return 'http://dashboardbaseurl.com/e/environment_id';
      }),
    } as unknown as jest.Mocked<ManagedAuthClientManager>;
    client = new LogsApiClient(mockAuthManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryLogs', () => {
    it('should query logs with all parameters', async () => {
      const mockResponse = new Map<string, ListLogsResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.queryLogs(
        {
          query: 'content:test',
          from: 'now-1h',
          to: 'now',
          limit: 50,
          sort: '-timestamp',
        },
        'testAlias',
      );

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/logs/search',
        {
          query: 'content:test',
          from: 'now-1h',
          to: 'now',
          limit: 50,
          sort: '-timestamp',
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use default values for optional parameters', async () => {
      const mockResponse = new Map<string, ListLogsResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.queryLogs(
        {
          query: 'content:test',
          from: 'now-1h',
          to: 'now',
        },
        'testAlias',
      );

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/logs/search',
        {
          query: 'content:test',
          from: 'now-1h',
          to: 'now',
          limit: 100,
          sort: '-timestamp',
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });

    it.each([
      ['at the API page size', LogsApiClient.API_PAGE_SIZE],
      ['above the API page size', LogsApiClient.API_PAGE_SIZE * 5],
    ])('should clamp a limit %s to the API page size', async (_name, requested) => {
      const mockResponse = new Map<string, ListLogsResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      await client.queryLogs({ query: 'content:test', from: 'now-1h', to: 'now', limit: requested }, 'testAlias');

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/logs/search',
        {
          query: 'content:test',
          from: 'now-1h',
          to: 'now',
          limit: LogsApiClient.API_PAGE_SIZE,
          sort: '-timestamp',
        },
        'testAlias',
      );
    });
  });

  describe('formatList', () => {
    it('should format list', async () => {
      const mockResponse = new Map<string, ListLogsResponse>([
        ['testAlias', JSON.parse(readFileSync('src/capabilities/__tests__/resources/queryLogs.json', 'utf8'))],
      ]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryLogs({ query: 'content:test', from: 'now-1h', to: 'now' }, 'ALL_ENVIRONMENTS');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 log records');
      expect(result).toContain('DEBUG');
      expect(result).toContain(
        '2025-11-24T21:14:08.109Z DEBUG 408583 --- [http-nio-8084-exec-7] o.s.w.s.m.m.a.HttpEntityMethodProcessor  : Writing [{timestamp=Mon Nov 24 21:14:08 UTC 2025, status=500, error=Internal Server Error, path=/api/v1/worki (truncated)...]',
      );
    });

    it('should format list when sparse result', async () => {
      const mockResponse = new Map<string, ListLogsResponse>([
        [
          'testAlias',
          {
            results: [{ timestamp: 0, content: '' }],
          },
        ],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryLogs({ query: 'content:test', from: 'now-1h', to: 'now' }, 'ALL_ENVIRONMENTS');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 log records');
      expect(result).toContain('1970-01-01 00:00:00');
    });

    it('should format list when empty', async () => {
      const mockResponse = new Map<string, ListLogsResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryLogs({ query: 'content:test', from: 'now-1h', to: 'now' }, 'ALL_ENVIRONMENTS');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 0 log records');
    });

    it('should format empty logs list', async () => {
      const mockResponse = new Map<string, ListLogsResponse>([
        [
          'testAlias',
          {
            results: [],
          },
        ],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryLogs({ query: 'content:test', from: 'now-1h', to: 'now' }, 'ALL_ENVIRONMENTS');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 0 log records');
    });

    it('should show all retrieved logs', () => {
      // Create 150 mock logs to test that all are shown
      const mockLogs: LogEntry[] = Array.from({ length: 150 }, (_, i) => ({
        timestamp: 1704110400000 + i * 1000,
        content: `Log message ${i}`,
        status: i % 10 === 0 ? 'ERROR' : 'INFO',
        additionalColumns: {
          loglevel: [i % 10 === 0 ? 'ERROR' : 'INFO'],
          service: [`service-${i % 5}`],
        },
      }));
      const response = new Map<string, ListLogsResponse>([
        [
          'testAlias',
          {
            results: mockLogs,
          },
        ],
      ]);

      const result = client.formatList(response);

      // Should show all 150 logs, not just 20
      expect(result).toContain('Listing 150 log records');
      expect(result).toContain('Log message 0');
      expect(result).toContain('Log message 149');
    });

    it('should include metadata', () => {
      const mockLogs: LogEntry[] = [
        {
          timestamp: 1704110400000,
          content: 'Test log with metadata',
          additionalColumns: {
            service: ['payment-service'],
            environment: ['production'],
            version: ['1.2.3'],
          },
        },
      ];
      const response = new Map<string, ListLogsResponse>([
        [
          'testAlias',
          {
            results: mockLogs,
          },
        ],
      ]);

      const result = client.formatList(response);

      expect(result).toContain('service: payment-service');
      expect(result).toContain('environment: production');
      expect(result).toContain('version: 1.2.3');
    });

    it('should show that truncated when multiple pages', () => {
      const response = new Map<string, ListLogsResponse>([
        [
          'testAlias',
          {
            results: [
              {
                timestamp: 1704110400000,
                content: `My log message 1`,
                status: 'INFO',
              },
            ],
            sliceSize: 1,
            nextSliceKey: 'my-next-slice-key',
          },
        ],
      ]);

      const result = client.formatList(response);

      expect(result).toContain(`Results likely restricted due to maximum response size`);
    });

    it('should not show LLM awareness hint when no second page', () => {
      const response = new Map<string, ListLogsResponse>([
        [
          'testAlias',
          {
            results: [
              {
                timestamp: 1704110400000,
                content: `My log message 1`,
                status: 'INFO',
              },
            ],
            sliceSize: 1,
          },
        ],
      ]);
      const result = client.formatList(response);

      expect(result).not.toContain('Results likely restricted');
    });
  });
});
