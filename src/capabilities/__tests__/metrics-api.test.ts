import { MetricsApiClient, Metric, ListMetricsResponse, MetricDataResponse } from '../metrics-api';
import { ManagedAuthClientManager } from '../../authentication/managed-auth-client';
import { readFileSync } from 'fs';

jest.mock('../../authentication/managed-auth-client');

describe('MetricsApiClient', () => {
  let mockAuthManager: jest.Mocked<ManagedAuthClientManager>;
  let client: MetricsApiClient;

  beforeEach(() => {
    mockAuthManager = {
      makeRequests: jest.fn(),
      getBaseUrl: jest.fn(() => {
        return 'http://dashboardbaseurl.com/e/environment_id';
      }),
    } as unknown as jest.Mocked<ManagedAuthClientManager>;
    client = new MetricsApiClient(mockAuthManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryMetrics', () => {
    it('should query metric data with all parameters', async () => {
      const mockResponse = new Map<string, MetricDataResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.queryMetrics(
        {
          metricSelector: 'builtin:service.response.time',
          from: 'now-1h',
          to: 'now',
          resolution: '5m',
          entitySelector: 'type(SERVICE)',
        },
        'testAlias',
      );

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/metrics/query',
        {
          metricSelector: 'builtin:service.response.time',
          resolution: '5m',
          from: 'now-1h',
          to: 'now',
          entitySelector: 'type(SERVICE)',
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listAvailableMetrics', () => {
    it('should pass all params', async () => {
      const mockResponse = new Map<string, ListMetricsResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.listAvailableMetrics(
        {
          entitySelector: 'my-entity-selector',
          metadataSelector: 'my-metadata-selector',
          text: 'my-text',
          fields: 'my-fields',
          pageSize: 12,
          nextPageKey: 'my-page-key',
          writtenSince: 'my-written-since',
        },
        'testAlias',
      );

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/metrics',
        {
          entitySelector: 'my-entity-selector',
          metadataSelector: 'my-metadata-selector',
          text: 'my-text',
          fields: 'my-fields',
          pageSize: 12,
          nextPageKey: 'my-page-key',
          writtenSince: 'my-written-since',
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should pass default params', async () => {
      const mockResponse = new Map<string, ListMetricsResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.listAvailableMetrics({}, 'testAlias');

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/metrics',
        {
          pageSize: 500,
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('formatList', () => {
    it('should format list', async () => {
      const mockResponse = new Map<string, ListMetricsResponse>([
        [
          'testAlias',
          JSON.parse(readFileSync('src/capabilities/__tests__/resources/listAvailableMetrics.json', 'utf8')),
        ],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listAvailableMetrics({}, 'testAlias');
      const result = client.formatMetricList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 of 188 metrics');
      expect(result).toContain('metricId: builtin:apps.other.crashAffectedUsersRate.os');
      expect(result).toContain('description: The estimated percentage of unique');
      expect(result).toContain('displayName: User rate - estimated users affected');
    });

    it('should show all retrieved metrics by default', () => {
      const mockMetrics: Metric[] = Array.from({ length: 100 }, (_, i) => ({
        metricId: `builtin:metric.${i}`,
        displayName: `Metric ${i}`,
      }));

      const response = new Map<string, ListMetricsResponse>([
        [
          'testAlias',
          {
            totalCount: 200,
            metrics: mockMetrics,
          },
        ],
      ]);

      const result = client.formatMetricList(response);

      expect(result).toContain('Listing 100 of 200 metrics');
      expect(result).toContain('builtin:metric.0');
      expect(result).toContain('builtin:metric.99');
    });

    it('should format list when sparse metric', async () => {
      const mockResponse = new Map<string, ListMetricsResponse>([
        [
          'testAlias',
          {
            metrics: [{}],
          },
        ],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listAvailableMetrics({}, 'ALL_ENVIRONMENTS');
      const result = client.formatMetricList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 metrics');
      expect(result).toContain('metricId: undefined');
    });

    it('should format list when empty', async () => {
      const mockResponse = new Map<string, ListMetricsResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listAvailableMetrics({}, 'testAlias');
      const result = client.formatMetricList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 0 metrics');
    });

    it('should handle empty list', async () => {
      const mockResponse = new Map<string, ListMetricsResponse>([
        [
          'testAlias',
          {
            totalCount: 0,
            metrics: [],
          },
        ],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listAvailableMetrics({}, 'testAlias');
      const result = client.formatMetricList(response);

      expect(result).toContain('Listing 0 metrics');
    });
  });

  describe('formatMetricDetails', () => {
    it('should format details', async () => {
      const mockResponse = new Map<string, Metric>([
        ['testAlias', JSON.parse(readFileSync('src/capabilities/__tests__/resources/getMetricDetails.json', 'utf8'))],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getMetricDetails('my-id', 'testAlias');
      const result = client.formatMetricDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of metric from environment testAlias in the following json');
      expect(result).toContain('"displayName":"CPU usage %"');
      expect(result).toContain('"metricId":"builtin:host.cpu.usage"');
    });

    it('should format details when sparse data', async () => {
      const mockResponse = new Map<string, Metric>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getMetricDetails('my-id', 'testAlias');
      const result = client.formatMetricDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of metric from environment testAlias in the following json');
      expect(result).toContain('{}');
    });
  });

  describe('formatMetricData', () => {
    it('should format list', async () => {
      const mockResponse = new Map<string, MetricDataResponse>([
        ['testAlias', JSON.parse(readFileSync('src/capabilities/__tests__/resources/queryMetrics.json', 'utf8'))],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryMetrics(
        { metricSelector: 'my-selector', from: 'now-1h', to: 'now' },
        'testAlias',
      );
      const result = client.formatMetricData(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing data series from environment testAlias, each with timestamped datapoints');
      expect(result).toContain('resolution: 1h');
      expect(result).toContain('metricId: builtin:host.cpu.usage');
      expect(result).toContain('dimensionData: {"dt.entity.host":"HOST-1D1EA84AB7DF62B4"}');
      expect(result).toContain('dimensions: ["HOST-1D1EA84AB7DF62B4"]');
      expect(result).toContain('timestamped datapoints: 1763935200000: 4.1, 1763938800000: null, 1763942400000: 5.2');
    });

    it('should format list when sparse data series', async () => {
      const mockResponse = new Map<string, MetricDataResponse>([
        [
          'testAlias',
          {
            result: [
              {
                data: [{}],
                metricId: 'builtin:host.cpu.usage',
              },
            ],
          },
        ],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);
      const response = await client.queryMetrics(
        { metricSelector: 'my-selector', from: 'now-1h', to: 'now' },
        'testAlias',
      );
      const result = client.formatMetricData(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing data series');
      expect(result).toContain('Listing 1 data series');
      expect(result).toContain('metricId: builtin:host.cpu.usage');
      expect(result).toContain('No datapoints');
    });

    it('should format list when empty', async () => {
      const mockResponse = new Map<string, MetricDataResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryMetrics(
        { metricSelector: 'my-selector', from: 'now-1h', to: 'now' },
        'testAlias',
      );
      const result = client.formatMetricData(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing data series from environment testAlias (no datapoints found)');
    });

    it('should handle empty list', async () => {
      const mockResponse = new Map<string, MetricDataResponse>([
        [
          'testAlias',
          {
            totalCount: 0,
            result: [],
          },
        ],
      ]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryMetrics(
        { metricSelector: 'my-selector', from: 'now-1h', to: 'now' },
        'testAlias',
      );
      const result = client.formatMetricData(response);

      expect(result).toContain('Listing data series from environment testAlias (no datapoints found)');
    });
  });
});
