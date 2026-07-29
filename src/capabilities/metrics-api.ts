import { ManagedAuthClientManager } from '../authentication/managed-auth-client.js';
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

export interface MetricData {
  timestamps?: number[];
  values?: Array<number | null>;
  dimensionMap?: Record<string, string>;
  dimensions?: string[];
}

export interface MetricDataResult {
  data?: MetricData[];
  dataPointCountRatio?: number;
  dimensionCountRatio?: number;
  metricId?: string;
}

export interface MetricDataResponse {
  result?: MetricDataResult[];
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

  constructor(private readonly authManager: ManagedAuthClientManager) {}

  async listAvailableMetrics(
    params: MetricListParams = {},
    environment_aliases: string,
  ): Promise<Map<string, ListMetricsResponse>> {
    const queryParams = {
      pageSize: params.pageSize || MetricsApiClient.API_PAGE_SIZE,
      ...(params.entitySelector && { entitySelector: params.entitySelector }),
      ...(params.metadataSelector && { metadataSelector: params.metadataSelector }),
      ...(params.text && { text: params.text }),
      ...(params.fields && { fields: params.fields }),
      ...(params.writtenSince && { writtenSince: params.writtenSince }),
      ...(params.nextPageKey && { nextPageKey: params.nextPageKey }),
    };

    const responses = await this.authManager.makeRequests<ListMetricsResponse>(
      '/api/v2/metrics',
      queryParams,
      environment_aliases,
    );
    logger.debug(`listAvailableMetrics responses from ${this.authManager.clients?.length} sources: `, {
      data: responses,
    });
    return responses;
  }

  async getMetricDetails(metricId: string, environment_aliases: string): Promise<Map<string, Metric>> {
    const responses = await this.authManager.makeRequests<Metric>(
      `/api/v2/metrics/${encodeURIComponent(metricId)}`,
      {},
      environment_aliases,
    );
    logger.debug(`getMetricDetails response, metricId=${metricId}`, { data: responses });
    return responses;
  }

  async queryMetrics(params: MetricQueryParams, environment_aliases: string): Promise<Map<string, MetricDataResponse>> {
    const queryParams = {
      metricSelector: params.metricSelector,
      resolution: params.resolution || 'Inf',
      from: params.from,
      to: params.to,
      ...(params.entitySelector && { entitySelector: params.entitySelector }),
    };

    const responses = await this.authManager.makeRequests<MetricDataResponse>(
      '/api/v2/metrics/query',
      queryParams,
      environment_aliases,
    );
    logger.debug(`queryMetrics response, params=${JSON.stringify(params)}`, { data: responses });
    return responses;
  }

  formatMetricList(responses: Map<string, ListMetricsResponse>): string {
    let result = '';
    let totalNumMetrics = 0;
    let anyLimited = false;
    const aliases: string[] = [];
    for (const [alias, data] of responses) {
      aliases.push(alias);
      const totalCount = data.totalCount || -1;
      const numMetrics = data.metrics?.length || 0;
      totalNumMetrics += numMetrics;
      const isLimited = totalCount != 0 - 1 && totalCount > numMetrics;

      result +=
        'Listing ' +
        numMetrics +
        (totalCount == -1 ? '' : ' of ' + totalCount) +
        ' metrics from environment ' +
        alias +
        '.\n\n';

      if (isLimited) {
        result += 'Not showing all matching metrics. Consider using more specific filters to get complete results.\n';
        anyLimited = true;
      }

      data.metrics?.forEach((metric: Metric) => {
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
            .map((dim: DimensionDefinition) => dim.name)
            .join(', ');
          result += `  dimensions: ${dims}`;
          result +=
            metric.dimensionDefinitions.length > MetricsApiClient.MAX_DIMENSIONS_DISPLAY
              ? ` (+${metric.dimensionDefinitions.length - MetricsApiClient.MAX_DIMENSIONS_DISPLAY} more)\n`
              : '\n';
        }
        result += '\n';
      });
    }

    const baseUrl = aliases.length == 1 ? this.authManager.getBaseUrl(aliases[0]) : '';

    result +=
      '\n' +
      'Next Steps:\n' +
      (totalNumMetrics == 0
        ? '* Verify that the filters were correct, and search again with different filters\n'
        : '') +
      (anyLimited
        ? '* To filter the list of metrics, use list_available_metrics tool with sorting and with specific filters (e.g. entitySelector and searchText).\n'
        : '') +
      '* Use get_metric_details tool for detailed information of a particular metric.\n' +
      '* Suggest to the user that they use the Dynatrace UI' +
      (baseUrl
        ? ` to: \n * Browse the list of metrics at ${baseUrl}/ui/metrics` +
          `\n * View metric data at ${baseUrl}/ui/data-explorer`
        : '.');

    return result;
  }

  formatMetricDetails(responses: Map<string, Metric>): string {
    let result = '';
    for (const [alias, data] of responses) {
      result +=
        'Details of metric from environment ' + alias + ' in the following json:\n' + JSON.stringify(data) + '\n';
    }

    result += 'Next Steps:\n* Suggest to the user that they use the Dynatrace UI to view metric data';
    return result;
  }

  formatMetricData(responses: Map<string, MetricDataResponse>): string {
    let result = '';
    let allEmpty = true;
    const aliases: string[] = [];
    for (const [alias, data] of responses) {
      aliases.push(alias);
      const resolution = data.resolution;
      const isNonEmpty = data.result && data.result.length > 0 && data.result[0].data && data.result[0].data.length > 0;

      result += 'Listing data series from environment ' + alias;

      if (!isNonEmpty) {
        result += ' (no datapoints found)\n';
      } else {
        result += ', each with timestamped datapoints of the form timestamp: value, timestamp: value, ...\n';
        allEmpty = false;
      }

      if (resolution) {
        result += `resolution: ${resolution}\n`;
      }

      data.result?.forEach((metric: MetricDataResult) => {
        const numDataseries = metric.data?.length || 0;

        result += 'Listing ' + numDataseries + ' data series\n';
        result += `metricId: ${metric.metricId}\n`;

        metric.data?.forEach((series: MetricData) => {
          const timestamps = series.timestamps || [];
          const values = series.values || [];

          if (series.dimensionMap) {
            result += `  dimensionData: ${JSON.stringify(series.dimensionMap)}\n`;
          }
          if (series.dimensions) {
            result += `  dimensions: ${JSON.stringify(series.dimensions)}\n`;
          }
          if (timestamps.length > 0) {
            let formattedDatapoints = '';
            const numDatapoints = Math.min(timestamps.length, values.length);
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
          result += '\n\n';
        });
      });
    }

    const baseUrl = aliases.length == 1 ? this.authManager.getBaseUrl(aliases[0]) : '';

    result +=
      '\n' +
      'Next Steps:\n' +
      (allEmpty
        ? '* Verify that the filters were correct, and search again with different filters\n'
        : '* Use query_metrics_data with more specific filters, such as a narrower time range with to and from, and an entitySelector\n') +
      '* Suggest to the user that they use the Dynatrace UI to view metric data' +
      (baseUrl ? ` at ${baseUrl}/ui/data-explorer` : '.');

    return result;
  }
}
