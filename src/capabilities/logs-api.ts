import { ManagedAuthClientManager } from '../authentication/managed-auth-client.js';
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

export class LogsApiClient {
  private static readonly API_PAGE_SIZE = 1000;

  constructor(private authManager: ManagedAuthClientManager) {}

  async queryLogs(params: LogQueryParams, environment_aliases: string): Promise<Map<string, ListLogsResponse>> {
    const queryParams = {
      query: params.query || '',
      from: params.from,
      to: params.to,
      limit: Math.min(params.limit || 100, LogsApiClient.API_PAGE_SIZE),
      sort: params.sort || '-timestamp',
    };

    const responses = await this.authManager.makeRequests('/api/v2/logs/search', queryParams, environment_aliases);
    logger.debug('queryLogs response: ', { data: responses });
    return responses;
  }

  formatList(responses: Map<string, ListLogsResponse>): string {
    let result = '';
    let totalNumLogs = 0;
    let anyLimited = false;
    const aliases: string[] = [];
    for (const [alias, data] of responses) {
      aliases.push(alias);
      const numLogs = data.results?.length || 0;
      totalNumLogs = totalNumLogs + numLogs;
      const isLimited = data.nextSliceKey != undefined;

      result += 'Listing ' + numLogs + ' log records from environment ' + alias + '.\n\n';

      if (isLimited) {
        result += 'Results likely restricted due to maximum response size, consider using a more specific filter.';
        anyLimited = true;
      }

      data.results?.forEach((log: LogEntry) => {
        const timestamp = formatTimestamp(log.timestamp);
        // Enhanced level detection for better error identification
        const level = log.additionalColumns?.loglevel?.[0] || log.status || log.log_level || 'NONE';

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
        result += '\n\n';
      });
    }

    const baseUrl = aliases.length == 1 ? this.authManager.getBaseUrl(aliases[0]) : '';

    result =
      result +
      '\n' +
      'Next Steps:\n' +
      (totalNumLogs == 0 ? '* Try broader search terms or expand the time range\n' : '') +
      (anyLimited
        ? '* Use more restrictive filters, such as a narrower time range or more specific search terms\n'
        : '') +
      (totalNumLogs > 1 ? '* Use sort (e.g. with "-timestamp" for newest logs first).\n' : '') +
      '* Suggest to the user that they use the Dynatrace UI to view metric data' +
      (baseUrl ? ` at ${baseUrl}/ui/log-monitoring.` : '.') +
      '\n' +
      '* Use list_problems to see what problems Dynatrace knows of, if not already done so\n';

    return result;
  }
}
