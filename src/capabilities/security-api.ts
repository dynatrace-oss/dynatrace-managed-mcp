import { ManagedAuthClient } from '../authentication/managed-auth-client';

import { formatTimestamp } from '../utils/date-formatter';
import { logger } from '../utils/logger';

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
  managementZones?: Array<{
    id: string;
    name: string;
  }>;
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

export interface SecurityProblemDetail extends SecurityProblem {
  description?: string;
  remediationItems?: Array<{
    id: string;
    name: string;
    type: string;
    state: string;
  }>;
  events?: Array<{
    eventType: string;
    timestamp: number;
    entityId?: string;
  }>;
  codeLocations?: any[];
}

export class SecurityApiClient {
  static readonly API_PAGE_SIZE = 200;
  static readonly MAX_CVES_DISPLAY = 11;

  constructor(private authClient: ManagedAuthClient) {}

  async listSecurityProblems(params: SecurityProblemQueryParams = {}): Promise<ListSecurityProblemsResponse> {
    const queryParams = {
      pageSize: params.pageSize || SecurityApiClient.API_PAGE_SIZE,
      ...(params.riskLevel && { riskLevel: params.riskLevel }),
      ...(params.status && { securityProblemSelector: `status("${params.status}")` }),
      ...(params.entitySelector && { entitySelector: params.entitySelector }),
      ...(params.from && { from: params.from }),
      ...(params.to && { to: params.to }),
      ...(params.sort && { sort: params.sort }),
    };

    const response = await this.authClient.makeRequest('/api/v2/securityProblems', queryParams);
    logger.debug('listSecurityProblems response', { data: response });
    return response;
  }

  async getSecurityProblemDetails(problemId: string): Promise<any> {
    const response = await this.authClient.makeRequest(`/api/v2/securityProblems/${encodeURIComponent(problemId)}`);
    logger.debug('getSecurityProblemDetails response', { data: response });
    return response;
  }

  formatList(response: ListSecurityProblemsResponse): string {
    let totalCount = response.totalCount || -1;
    let numProblems = response.securityProblems?.length || 0;
    let isLimited = totalCount != 0 - 1 && totalCount > numProblems;

    let result =
      'Listing ' +
      numProblems +
      (totalCount == -1 ? '' : ' of ' + totalCount) +
      ' security vulnerabilities in the following json.\n';

    if (isLimited) {
      result +=
        'Not showing all matching vulnerabilities. Consider using more specific filters (status, impactLevel, entitySelector) to get complete results.\n';
    }

    response.securityProblems?.forEach((problem: any) => {
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
        result +=
          `  cveIds: ${problem.cveIds.slice(0, SecurityApiClient.MAX_CVES_DISPLAY).join(', ')}` +
          `${problem.cveIds.length > SecurityApiClient.MAX_CVES_DISPLAY ? ` (+${problem.cveIds.length - SecurityApiClient.MAX_CVES_DISPLAY} more)` : ''}\n`;
      }
      if (problem.firstSeenTimestamp) {
        result += `  firstSeen: ${formatTimestamp(problem.firstSeenTimestamp)}\n`;
      }
      result += '\n';
    });

    result +=
      '\n' +
      'Next Steps:\n' +
      (numProblems == 0
        ? '* Verify that the filters such as entitySelector, status and time range were correct, and search again with different filters.\n'
        : '') +
      (isLimited ? '* Use more restrictive filters, such as a more specific entitySelector and status.\n' : '') +
      (numProblems > 1 ? '* Use sort (e.g. with "-riskAssessment.riskScore" for highest risk score first).\n' : '') +
      '* If the user is interested in a specific vulnerability, use the get_security_problem_details tool. Use the securityProblemId for this.\n' +
      '* Suggest to the user that they view the security vulnerabilties in the Dynatrace UI at ' +
      `${this.authClient.baseUrl}/ui/security/overview for an overview,` +
      `or ${this.authClient.baseUrl}/ui/security/vulnerabilities for a list of third-party vulnerabilties` +
      '\n';

    return result;
  }

  formatDetails(response: any): string {
    let result =
      'Details of security problem in the following json.\n' +
      JSON.stringify(response) +
      '\n' +
      'Next Steps:\n' +
      '* If there are affectedEntities, suggest to the user that they could get further information about those entities with get_entity_detais tool, using the entityId.\n' +
      '* Suggest to the user that they view the security vulnerability in the Dynatrace UI ' +
      `${this.authClient.baseUrl}/ui/security/vulnerabilities/<securityProblemId>, using the securityProblemId in the URL\n`;

    return result;
  }
}
