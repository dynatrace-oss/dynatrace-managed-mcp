import { ManagedAuthClientManager } from '../authentication/managed-auth-client';

import { formatTimestamp } from '../utils/date-formatter';
import { logger } from '../utils/logger';
import ManagementZone from './management-zones.model';

export interface SecurityProblemQueryParams {
  riskLevel?: string; // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: string; // 'OPEN' | 'RESOLVED';
  entitySelector?: string;
  from?: string;
  to?: string;
  pageSize?: number;
  sort?: string;
}

export interface ListSecurityProblemsResponse {
  securityProblems?: SecurityProblem[];
  totalCount?: number;
  pageSize?: number;
  nextPageKey?: string;
}

export interface SecurityProblem {
  securityProblemId?: string;
  displayId?: string;
  status?: 'OPEN' | 'RESOLVED' | 'MUTED';
  muted?: boolean;
  externalVulnerabilityId?: string;
  vulnerabilityType?: 'CODE_LEVEL' | 'THIRD_PARTY' | 'RUNTIME';
  title?: string;
  packageName?: string;
  technology?: string;
  cveIds?: string[];
  riskAssessment?: {
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskScore?: number;
    riskVector?: string;
    exposure?: 'PUBLIC' | 'INTERNAL' | 'NOT_AVAILABLE';
    dataAssets?: 'PUBLIC' | 'INTERNAL' | 'RESTRICTED' | 'NOT_AVAILABLE';
    publicExploit?: 'AVAILABLE' | 'NOT_AVAILABLE';
  };
  managementZones?: ManagementZone[];
  affectedEntities?: Array<{
    entityId?: string;
    displayName?: string;
    entityType?: string;
  }>;
  vulnerableComponents?: Array<{
    id?: string;
    displayName?: string;
    shortName?: string;
    fileName?: string;
    numberOfVulnerableProcessGroups?: number;
  }>;
  firstSeenTimestamp?: number;
  lastUpdatedTimestamp?: number;
}

export class SecurityApiClient {
  static readonly API_PAGE_SIZE = 100;
  static readonly MAX_CVES_DISPLAY = 11;

  constructor(private readonly authManager: ManagedAuthClientManager) {}

  async listSecurityProblems(
    environment_aliases: string,
    params: SecurityProblemQueryParams = {},
  ): Promise<Map<string, ListSecurityProblemsResponse>> {
    const queryParams = {
      pageSize: params.pageSize || SecurityApiClient.API_PAGE_SIZE,
      ...(params.riskLevel && { riskLevel: params.riskLevel }),
      ...(params.status && { securityProblemSelector: `status("${params.status}")` }),
      ...(params.entitySelector && { entitySelector: params.entitySelector }),
      ...(params.from && { from: params.from }),
      ...(params.to && { to: params.to }),
      ...(params.sort && { sort: params.sort }),
    };

    const responses = await this.authManager.makeRequests<ListSecurityProblemsResponse>(
      '/api/v2/securityProblems',
      queryParams,
      environment_aliases,
    );
    logger.debug('listSecurityProblems response', { data: responses });
    return responses;
  }

  async getSecurityProblemDetails(
    problemId: string,
    environment_aliases: string,
  ): Promise<Map<string, SecurityProblem>> {
    const responses = await this.authManager.makeRequests<SecurityProblem>(
      `/api/v2/securityProblems/${encodeURIComponent(problemId)}`,
      {},
      environment_aliases,
    );
    logger.debug('getSecurityProblemDetails response', { data: responses });
    return responses;
  }

  formatList(responses: Map<string, ListSecurityProblemsResponse>): string {
    let result = '';
    let totalNumProblems = 0;
    let anyLimited = false;
    const aliases: string[] = [];
    for (const [alias, data] of responses) {
      aliases.push(alias);
      const totalCount = data.totalCount || -1;
      const numProblems = data.securityProblems?.length || 0;
      totalNumProblems += numProblems;
      const isLimited = totalCount != 0 - 1 && totalCount > numProblems;

      result +=
        'Listing ' +
        numProblems +
        (totalCount == -1 ? '' : ' of ' + totalCount) +
        ' security vulnerabilities from environment ' +
        alias +
        ' in the following json.\n';

      if (isLimited) {
        result +=
          'Not showing all matching vulnerabilities. Consider using more specific filters (status, impactLevel, entitySelector) to get complete results.\n';
        anyLimited = true;
      }

      data.securityProblems?.forEach((problem: SecurityProblem) => {
        result += `securityProblemId: ${problem.securityProblemId}\n`;
        result += `  displayId: ${problem.displayId}\n`;
        result += `  title: ${problem.title}\n`;
        result += `  status: ${problem.status}\n`;
        result += `  vulnerabilityType: ${problem.vulnerabilityType}\n`;
        result += `  technology: ${problem.technology}\n`;
        if (problem.riskAssessment) {
          result +=
            `  riskLevel: ${problem.riskAssessment.riskLevel}; ` +
            `riskScore: ${problem.riskAssessment.riskScore}; ` +
            `exposure: ${problem.riskAssessment.exposure}\n`;
        }
        if (problem.cveIds && problem.cveIds.length > 0) {
          result += `  cveIds: ${problem.cveIds.slice(0, SecurityApiClient.MAX_CVES_DISPLAY).join(', ')}`;
          result +=
            problem.cveIds.length > SecurityApiClient.MAX_CVES_DISPLAY
              ? ` (+${problem.cveIds.length - SecurityApiClient.MAX_CVES_DISPLAY} more)\n`
              : '\n';
        }
        if (problem.firstSeenTimestamp) {
          result += `  firstSeen: ${formatTimestamp(problem.firstSeenTimestamp)}\n`;
        }
        result += '\n';
      });
    }

    const baseUrl = aliases.length == 1 ? this.authManager.getBaseUrl(aliases[0]) : '';

    result +=
      '\n' +
      'Next Steps:\n' +
      (totalNumProblems == 0
        ? '* Verify that the filters such as entitySelector, status and time range were correct, and search again with different filters.\n'
        : '') +
      (anyLimited ? '* Use more restrictive filters, such as a more specific entitySelector and status.\n' : '') +
      (totalNumProblems > 1
        ? '* Use sort (e.g. with "-riskAssessment.riskScore" for highest risk score first).\n'
        : '') +
      '* If the user is interested in a specific vulnerability, use the get_security_problem_details tool. Use the securityProblemId for this.\n' +
      '* Suggest to the user that they view the security vulnerabilties in the Dynatrace UI' +
      (baseUrl
        ? ` at ${baseUrl}/ui/security/overview for an overview, or ${baseUrl}/ui/security/vulnerabilities for a list of third-party vulnerabilities`
        : '.');

    return result;
  }

  formatDetails(responses: Map<string, SecurityProblem>): string {
    let result = '';
    const aliases: string[] = [];
    for (const [alias, data] of responses) {
      aliases.push(alias);
      result +=
        'Details of security problem from environment ' +
        alias +
        ' in the following json:\n' +
        JSON.stringify(data) +
        '\n';
    }

    const baseUrl = aliases.length == 1 ? this.authManager.getBaseUrl(aliases[0]) : '';

    result +=
      'Next Steps:\n' +
      '* If there are affectedEntities, suggest to the user that they could get further information about those entities with get_entity_detais tool, using the entityId.\n' +
      '* Suggest to the user that they view the security vulnerability in the Dynatrace UI using the securityProblemId in the URL\n' +
      (baseUrl
        ? ` at ${baseUrl}/ui/security/vulnerabilities/<securityProblemId>, using the securityProblemId in the URL\n`
        : '.');

    return result;
  }
}
