import { ManagedAuthClient } from '../authentication/managed-auth-client.js';
import { formatTimestamp } from '../utils/date-formatter';
import { logger } from '../utils/logger';

export interface MetricListParams {
  entitySelector?: string;
  metadataSelector?: string;
  text?: string;
  fields?: string;
  pageSize?: number;
  nextPageKey?: string;
  writtenSince?: string;
}

export interface MetricQueryParams {
  metricSelector: string;
  resolution?: string;
  from: string;
  to: string;
  entitySelector?: string;
}

export interface ListMetricsResponse {
  metrics?: Metric[];
  totalCount?: number;
  nextPageKey?: string;
}

export interface MetricDataResponse {
  result?: Array<{
    data?: Array<{
      timestamps?: number[];
      vaules?: any[];
      dimensionMap?: Record<string, string>;
      dimensions?: string[];
    }>;
    dataPointCountRatio?: number;
    dimensionCountRatio?: number;
    metricId?: string;
  }>;
  resolution?: string;
  totalCount?: number;
  nextPageKey?: string;
}

export interface Metric {
  metricId?: string;
  displayName?: string;
  description?: string;
  unit?: string;
  aggregationTypes?: string[];
  dimensionDefinitions?: DimensionDefinition[];
}

export interface DimensionDefinition {
  name: string;
  displayName: string;
  key: string;
}

export class MetricsApiClient {
  static readonly MAX_DATA_POINTS = 50;
  static readonly API_PAGE_SIZE = 500;
  static readonly MAX_DIMENSIONS_DISPLAY = 11;

  constructor(private authClient: ManagedAuthClient) {}

  async listAvailableMetrics(params: MetricListParams = {}): Promise<ListMetricsResponse> {
    const queryParams = {
      pageSize: params.pageSize || MetricsApiClient.API_PAGE_SIZE,
      ...(params.entitySelector && { entitySelector: params.entitySelector }),
      ...(params.metadataSelector && { metadataSelector: params.metadataSelector }),
      ...(params.text && { text: params.text }),
      ...(params.fields && { fields: params.fields }),
      ...(params.writtenSince && { writtenSince: params.writtenSince }),
      ...(params.nextPageKey && { nextPageKey: params.nextPageKey }),
    };

    const response = await this.authClient.makeRequest('/api/v2/metrics', queryParams);
    logger.debug('listAvailableMetrics response', { data: response });
    return response;
  }

  async getMetricDetails(metricId: string): Promise<any> {
    const response = await this.authClient.makeRequest(`/api/v2/metrics/${encodeURIComponent(metricId)}`);
    logger.debug(`getMetricDetails response, metricId=${metricId}`, { data: response });
    return response;
  }

  async queryMetrics(params: MetricQueryParams): Promise<MetricDataResponse> {
    const queryParams = {
      metricSelector: params.metricSelector,
      resolution: params.resolution || 'Inf',
      from: params.from,
      to: params.to,
      ...(params.entitySelector && { entitySelector: params.entitySelector }),
    };

    const response = await this.authClient.makeRequest('/api/v2/metrics/query', queryParams);
    logger.debug(`queryMetrics response, params=${JSON.stringify(params)}`, { data: response });
    return response;
  }

  formatMetricList(response: ListMetricsResponse): string {
    let totalCount = response?.totalCount || -1;
    let numMetrics = response?.metrics?.length || 0;
    let isLimited = totalCount != 0 - 1 && totalCount > numMetrics;

    let result = 'Listing ' + numMetrics + (totalCount == -1 ? '' : ' of ' + totalCount) + ' metrics.\n';

    if (isLimited) {
      result += 'Not showing all matching metrics. Consider using more specific filters to get complete results.\n';
    }

    response.metrics?.forEach((metric: any) => {
      result += `metricId: ${metric.metricId}\n`;
      if (metric.displayName) result += `  displayName: ${metric.displayName}\n`;
      if (metric.description) result += `  description: ${metric.description}\n`;
      if (metric.unit) result += `  unit: ${metric.unit}\n`;

      // High Priority: Add aggregation types
      if (metric.aggregationTypes && metric.aggregationTypes.length > 0) {
        result += `  aggregationTypes: ${metric.aggregationTypes.join(', ')}\n`;
      }

      // High Priority: Add dimension definitions (key for filtering)
      if (metric.dimensionDefinitions && metric.dimensionDefinitions.length > 0) {
        const dims = metric.dimensionDefinitions
          .slice(0, MetricsApiClient.MAX_DIMENSIONS_DISPLAY)
          .map((dim: any) => dim.name)
          .join(', ');
        result += `  dimensions: ${dims}${metric.dimensionDefinitions.length > MetricsApiClient.MAX_DIMENSIONS_DISPLAY ? ` (+${metric.dimensionDefinitions.length - MetricsApiClient.MAX_DIMENSIONS_DISPLAY} more)` : ''}\n`;
      }

      result += '\n';
    });

    result +=
      '\n' +
      'Next Steps:\n' +
      (numMetrics == 0 ? '* Verify that the filters were correct, and search again with different filters\n' : '') +
      (isLimited
        ? '* To filter the list of metrics, use list_available_metrics tool with sorting and with specific filters (e.g. entitySelector and searchText).\n'
        : '') +
      '* Use get_metric_details tool for detailed information of a particular metric.\n' +
      '* Suggest to the user that they use the Dynatrace UI to:\n' +
      `   * Browse the list of metrics at ${this.authClient.baseUrl}/ui/metrics' + '\n` +
      `   * View metric data at ${this.authClient.baseUrl}/ui/data-explorer' + '\n`;

    return result;
  }

  formatMetricDetails(response: any): string {
    let result =
      'Details of metric in the following json.\n' +
      JSON.stringify(response) +
      '\n' +
      'Next Steps:\n' +
      '* Suggest to the user that they use the Dynatrace UI to view metric data at ' +
      `${this.authClient.baseUrl}/ui/data-explorer`;

    return result;
  }

  formatMetricData(response: MetricDataResponse): string {
    let resolution = response.resolution;
    let isNonEmpty =
      response.result && response.result.length > 0 && response.result[0].data && response.result[0].data.length > 0;

    let result = 'Listing data series';

    if (!isNonEmpty) {
      result += ' (no datapoints found)\n';
    } else {
      result += ', each with timestamped datapoints of the form timestamp: value, timestamp: value, ...\n';
    }

    if (resolution) {
      result += `resolution: ${resolution}\n`;
    }

    response.result?.forEach((metric: any) => {
      let numDataseries = metric.data?.length || 0;

      result += 'Listing ' + numDataseries + ' data series\n';
      result += `metricId: ${metric.metricId}\n`;

      metric.data?.forEach((series: any) => {
        let timestamps = series.timestamps || [];
        let values = series.values || [];

        if (series.dimensionMap) {
          result += `  dimensionData: ${JSON.stringify(series.dimensionMap)}\n`;
        }
        if (series.dimensions) {
          result += `  dimensions: ${JSON.stringify(series.dimensions)}\n`;
        }
        if (timestamps.length > 0) {
          let formattedDatapoints = '';
          let numDatapoints = Math.min(timestamps.length, values.length);
          for (let i = 0; i < Math.min(numDatapoints, MetricsApiClient.MAX_DATA_POINTS); i++) {
            formattedDatapoints += `${timestamps[i]}: ${values[i]}, `;
          }
          result += `  timestamped datapoints: ${formattedDatapoints}`;
          if (numDatapoints > MetricsApiClient.MAX_DATA_POINTS) {
            result += ` and ${numDatapoints - MetricsApiClient.MAX_DATA_POINTS} more data points`;
          }
          result += '\n';
        } else {
          result += `  No datapoints\n`;
        }
        result += '\n';
      });
    });

    result +=
      '\n' +
      'Next Steps:\n' +
      (!isNonEmpty
        ? '* Verify that the filters were correct, and search again with different filters\n'
        : '* Use query_metrics_data with more specific filters, such as a narrower time range with to and from, and an entitySelector\n') +
      '* Suggest to the user that they use the Dynatrace UI to view metric data at ' +
      `${this.authClient.baseUrl}/ui/data-explorer` +
      '\n';

    return result;
  }
}
