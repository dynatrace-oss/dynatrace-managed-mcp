import { MetricsApiClient, Metric } from '../metrics-api';
import { ManagedAuthClient } from '../../authentication/managed-auth-client';
import { readFileSync } from 'fs';

jest.mock('../../authentication/managed-auth-client');

describe('MetricsApiClient', () => {
  let mockAuthClient: jest.Mocked<ManagedAuthClient>;
  let client: MetricsApiClient;

  beforeEach(() => {
    mockAuthClient = {
      makeRequest: jest.fn(),
    } as any;
    client = new MetricsApiClient(mockAuthClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryMetrics', () => {
    it('should query metric data with all parameters', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const result = await client.queryMetrics({
        metricSelector: 'builtin:service.response.time',
        from: 'now-1h',
        to: 'now',
        resolution: '5m',
        entitySelector: 'type(SERVICE)',
      });

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/metrics/query', {
        metricSelector: 'builtin:service.response.time',
        resolution: '5m',
        from: 'now-1h',
        to: 'now',
        entitySelector: 'type(SERVICE)',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('listAvailableMetrics', () => {
    it('should pass all params', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const result = await client.listAvailableMetrics({
        entitySelector: 'my-entity-selector',
        metadataSelector: 'my-metadata-selector',
        text: 'my-text',
        fields: 'my-fields',
        pageSize: 12,
        nextPageKey: 'my-page-key',
        writtenSince: 'my-written-since',
      });

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/metrics', {
        entitySelector: 'my-entity-selector',
        metadataSelector: 'my-metadata-selector',
        text: 'my-text',
        fields: 'my-fields',
        pageSize: 12,
        nextPageKey: 'my-page-key',
        writtenSince: 'my-written-since',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should pass default params', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const result = await client.listAvailableMetrics();

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/metrics', {
        pageSize: 500,
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('formatList', () => {
    it('should format list', async () => {
      const mockResponse = JSON.parse(
        readFileSync('src/capabilities/__tests__/resources/listAvailableMetrics.json', 'utf8'),
      );
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listAvailableMetrics({});
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
      const response = {
        totalCount: 200,
        metrics: mockMetrics,
      };
      const result = client.formatMetricList(response);

      expect(result).toContain('Listing 100 of 200 metrics');
      expect(result).toContain('builtin:metric.0');
      expect(result).toContain('builtin:metric.99');
    });

    it('should format list when sparse metric', async () => {
      const mockResponse = {
        metrics: [{}],
      };
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listAvailableMetrics({});
      const result = client.formatMetricList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 metrics');
      expect(result).toContain('metricId: undefined');
    });

    it('should format list when empty', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listAvailableMetrics({});
      const result = client.formatMetricList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 0 metrics');
    });

    it('should handle empty list', async () => {
      const mockResponse = {
        totalCount: 0,
        metrics: [],
      };
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listAvailableMetrics({});
      const result = client.formatMetricList(response);

      expect(result).toContain('Listing 0 metrics');
    });
  });

  describe('formatMetricDetails', () => {
    it('should format details', async () => {
      const mockResponse = JSON.parse(
        readFileSync('src/capabilities/__tests__/resources/getMetricDetails.json', 'utf8'),
      );
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.getMetricDetails('my-id');
      const result = client.formatMetricDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of metric in the following json');
      expect(result).toContain('\"displayName\":\"CPU usage %\"');
      expect(result).toContain('\"metricId\":\"builtin:host.cpu.usage\"');
    });

    it('should format details when sparse data', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.getMetricDetails('my-id');
      const result = client.formatMetricDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of metric in the following json');
      expect(result).toContain('{}');
    });
  });

  describe('formatMetricData', () => {
    it('should format list', async () => {
      const mockResponse = JSON.parse(readFileSync('src/capabilities/__tests__/resources/queryMetrics.json', 'utf8'));
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.queryMetrics({ metricSelector: 'my-selector', from: 'now-1h', to: 'now' });
      const result = client.formatMetricData(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing data series, each with timestamped datapoints');
      expect(result).toContain('resolution: 1h');
      expect(result).toContain('metricId: builtin:host.cpu.usage');
      expect(result).toContain('dimensionData: {\"dt.entity.host\":\"HOST-1D1EA84AB7DF62B4\"}');
      expect(result).toContain('dimensions: [\"HOST-1D1EA84AB7DF62B4\"]');
      expect(result).toContain('timestamped datapoints: 1763935200000: 4.1, 1763938800000: null, 1763942400000: 5.2');
    });

    it('should format list when sparse data series', async () => {
      const mockResponse = {
        result: [
          {
            data: [{}],
            metricId: 'builtin:host.cpu.usage',
          },
        ],
      };
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.queryMetrics({ metricSelector: 'my-selector', from: 'now-1h', to: 'now' });
      const result = client.formatMetricData(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing data series');
      expect(result).toContain('Listing 1 data series');
      expect(result).toContain('metricId: builtin:host.cpu.usage');
      expect(result).toContain('No datapoints');
    });

    it('should format list when empty', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.queryMetrics({ metricSelector: 'my-selector', from: 'now-1h', to: 'now' });
      const result = client.formatMetricData(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing data series (no datapoints found)');
    });

    it('should handle empty list', async () => {
      const mockResponse = {
        totalCount: 0,
        result: [],
      };
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.queryMetrics({ metricSelector: 'my-selector', from: 'now-1h', to: 'now' });
      const result = client.formatMetricData(response);

      expect(result).toContain('Listing data series (no datapoints found)');
    });
  });
});
