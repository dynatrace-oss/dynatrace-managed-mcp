import { ManagedAuthClient } from '../authentication/managed-auth-client.js';

import { logger } from '../utils/logger';

export interface SloQueryParams {
  sloSelector?: string;
  timeFrame?: string;
  from?: string;
  to?: string;
  demo?: boolean;
  pageSize?: number;
  evaluate?: boolean;
  sort?: string;
  enabledSlos?: string;
  showGlobalSlos?: boolean;
}

export interface GetSloQueryParams {
  id: string;
  from?: string;
  to?: string;
  timeFrame?: string;
}

export interface ListSlosResponse {
  slo?: SLO[];
  totalCount?: number;
  pageSize?: number;
  nextPageKey?: string;
}

export interface SLO {
  id?: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  target?: number;
  warning?: number;
  timeframe?: string;
  evaluatedPercentage?: number;
  errorBudget?: number;
  status?: string; // 'SUCCESS' | 'WARNING' | 'FAILURE'
  error?: string;
  errorBudgetBurnRate?: ErrorBudgetBurnRate;
  metricExpression?: string;
  filter?: string;
  evaluationType?: string;
  metricName?: string;
  evaluationWindow?: EvaluationWindow;
  customDescription?: string;
  useRateMetric?: boolean;
  metricRate?: string;
  metricNumerator?: string;
  metricDenominator?: string;
  managementZones?: any[];
}

export interface ErrorBudgetBurnRate {
  burnRateVisualizationEnabled?: boolean;
  fastBurnThreshold?: number;
}

export interface EvaluationWindow {
  startTime?: number;
  endTime?: number;
}

export class SloApiClient {
  static readonly API_PAGE_SIZE = 200;
  static readonly MAX_MANAGEMENT_ZONES_DISPLAY = 11;

  constructor(private authClient: ManagedAuthClient) {}

  async listSlos(params: SloQueryParams = {}): Promise<ListSlosResponse> {
    const queryParams: Record<string, any> = {
      pageSize: params.pageSize || SloApiClient.API_PAGE_SIZE,
      ...(params.sloSelector && { sloSelector: params.sloSelector }),
      ...(params.timeFrame && { timeFrame: params.timeFrame }),
      ...(params.from && { from: params.from }),
      ...(params.to && { to: params.to }),
      ...(params.demo && { demo: params.demo }),
      ...(params.evaluate && { evaluate: params.evaluate }),
      ...(params.enabledSlos && { enabledSlos: params.enabledSlos }),
      ...(params.showGlobalSlos && { showGlobalSlos: params.showGlobalSlos }),
      ...(params.sort && { sort: params.sort }),
    };

    const response = await this.authClient.makeRequest('/api/v2/slo', queryParams);
    logger.debug('listSLOs response', { data: response });
    return response;
  }

  async getSloDetails(params: GetSloQueryParams): Promise<any> {
    const queryParams: Record<string, any> = {
      ...(params.from && { from: params.from }),
      ...(params.to && { to: params.to }),
      ...(params.timeFrame && { timeFrame: params.timeFrame }),
    };
    if (!params.timeFrame && (params.from || params.to)) {
      queryParams.timeFrame = 'GTF';
    }

    const response = await this.authClient.makeRequest(`/api/v2/slo/${encodeURIComponent(params.id)}`, queryParams);
    logger.debug('getSLODetails response', { data: response });
    return response;
  }

  formatList(response: ListSlosResponse): string {
    let totalCount = response.totalCount || -1;
    let numSLOs = response.slo?.length || 0;
    let isLimited = totalCount != 0 - 1 && totalCount > numSLOs;

    let result = 'Listing ' + numSLOs + (totalCount == -1 ? '' : ' of ' + totalCount) + ' SLOs.\n';

    if (isLimited) {
      result +=
        'Not showing all matching SLOs. Consider using more specific filters (sloSelector) to get complete results.\n';
    }

    response.slo?.forEach((slo: any) => {
      result += `id: ${slo.id}\n`;
      result += `  name: ${slo.name}\n`;
      if (slo.description) {
        result += `${slo.description}\n`;
      }
      result += `  status: ${slo.status}\n`;
      result += `  target: ${slo.target}\n`;
      result += `  warning: ${slo.warning}\n`;
      result += `  enabled: ${slo.enabled}\n`;
      if (slo.timeframe) {
        result += `. timeframe: ${slo.timeframe}\n`;
      }
      if (slo.evaluatedPercentage !== undefined && slo.evaluatedPercentage !== -1) {
        result += `. evaluatedPercentage: ${slo.evaluatedPercentage}%\n`;
      }
      if (slo.errorBudget !== undefined && slo.errorBudget !== -1) {
        result += `  error budget: ${slo.errorBudget}%\n`;
      }
      if (slo.managementZones && slo.managementZones.length > 0) {
        const zones = slo.managementZones
          .slice(0, SloApiClient.MAX_MANAGEMENT_ZONES_DISPLAY)
          .map((zone: any) => zone.name || zone.id || zone)
          .join(', ');
        result += `  management zones: ${zones}${slo.managementZones.length > SloApiClient.MAX_MANAGEMENT_ZONES_DISPLAY ? ` (+${slo.managementZones.length - SloApiClient.MAX_MANAGEMENT_ZONES_DISPLAY} more)` : ''}\n`;
      }
      result += '\n';
    });

    result +=
      '\n' +
      'Next Steps:\n' +
      (numSLOs == 0
        ? '* Verify that the filters such as sloSelector were correct, and search again with different filters.\n'
        : '') +
      (isLimited ? '* Use more restrictive filters, such as a more specific sloSelector and status.\n' : '') +
      (numSLOs > 1 ? '* Use sort (e.g. with "+name" for ascending alphabetical order).\n' : '') +
      '* If the user is interested in a specific SLO, use the get_slo_details tool. Use the SLO id for this.\n' +
      '* Suggest to the user that they view the SLOs in the Dynatrace UI at ' +
      `${this.authClient.baseUrl}/ui/slo` +
      '\n';

    return result;
  }

  formatDetails(response: any): string {
    let result =
      'Details of SLO in the following json.\n' +
      JSON.stringify(response) +
      '\n' +
      'Next Steps:\n' +
      '* Suggest to the user that they view the SLO in the Dynatrace UI at ' +
      `${this.authClient.baseUrl}/ui/slo/<id>, using the SLO id in the URL` +
      '\n';

    return result;
  }
}
