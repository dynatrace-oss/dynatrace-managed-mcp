import { ManagedAuthClient } from '../authentication/managed-auth-client.js';
import { formatTimestamp } from '../utils/date-formatter';
import { logger } from '../utils/logger';

export interface LogQueryParams {
  query: string;
  from: string;
  to: string;
  limit?: number;
  sort?: string;
}

export interface ListLogsResponse {
  results?: LogEntry[];
  sliceSize?: number;
  nextSliceKey?: string;
}

export interface LogEntry {
  timestamp: number; // API returns integer UTC milliseconds
  content: string;
  status?: string; // API returns status (ERROR, WARN, etc.)
  eventType?: string; // API returns event.type
  additionalColumns?: {
    loglevel?: string[];
    [key: string]: any;
  };
  [key: string]: any;
}

export interface LogSearchResult {
  results: LogEntry[];
  totalCount: number;
  nextPageKey?: string;
  sliceSize?: number;
}

export class LogsApiClient {
  private static readonly API_PAGE_SIZE = 1000;

  constructor(private authClient: ManagedAuthClient) {}

  async queryLogs(params: LogQueryParams): Promise<ListLogsResponse> {
    const queryParams = {
      query: params.query || '',
      from: params.from,
      to: params.to,
      limit: Math.min(params.limit || 100, LogsApiClient.API_PAGE_SIZE),
      sort: params.sort || '-timestamp',
    };

    const response = await this.authClient.makeRequest('/api/v2/logs/search', queryParams);
    logger.debug('queryLogs response', { data: response });
    return response;
  }

  formatList(response: ListLogsResponse): string {
    let numLogs = response.results?.length || 0;
    let isLimited = response.nextSliceKey != undefined;

    let result = 'Listing ' + numLogs + ' log records.\n';

    if (isLimited) {
      result += 'Results likely restricted due to maximum response size, consider using a more specific filter.';
    }

    response.results?.forEach((log: any) => {
      const timestamp = formatTimestamp(log.timestamp);
      // Enhanced level detection for better error identification
      let level = log.additionalColumns?.loglevel?.[0] || log.status || log.log_level || 'NONE';

      result += `**${timestamp}** [${level}]\n`;
      result += `${log.content}\n`;

      // Medium Priority: Show eventType if available
      if (log.eventType) {
        result += `Event Type: ${log.eventType}\n`;
      }

      const metadata: string[] = [];
      if (log.additionalColumns) {
        Object.entries(log.additionalColumns).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0) {
            metadata.push(`${key}: ${value[0]}`);
          }
        });
      }
      if (metadata.length > 0) {
        // Medium Priority: Increased from 5 to 8 metadata fields
        result += `_${metadata.slice(0, 8).join(', ')}_\n`;
        if (metadata.length > 8) {
          result += `_... and ${metadata.length - 8} more metadata fields_\n`;
        }
      }
      result += '\n';
    });

    result +=
      '\n' +
      'Next Steps:\n' +
      (numLogs == 0 ? '* Try broader search terms or expand the time range\n' : '') +
      (isLimited
        ? '* Use more restrictive filters, such as a narrower time range or more specific search terms\n'
        : '') +
      (numLogs > 1 ? '* Use sort (e.g. with "-timestamp" for newest logs first).\n' : '') +
      '* Suggest to the user that they use the Dynatrace UI to view metric data at ' +
      `${this.authClient.baseUrl}/ui/log-monitoring` +
      '\n' +
      '* Use list_problems to see what problems Dynatrace knows of, if not already done so\n';

    return result;
  }
}
