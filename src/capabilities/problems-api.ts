import { ManagedAuthClient } from '../authentication/managed-auth-client.js';
import { formatTimestamp } from '../utils/date-formatter';
import { logger } from '../utils/logger';

export interface ProblemQueryParams {
  from?: string;
  to?: string;
  status?: string;
  impactLevel?: string;
  entitySelector?: string;
  pageSize?: number;
  sort?: string;
}

export interface ListProblemResponse {
  problems?: Problem[];
  totalCount?: number;
  pageSize?: number;
  nextPageKey?: string;
}

export interface Problem {
  problemId?: string;
  displayId?: string;
  title?: string;
  impactLevel?: string;
  severityLevel?: string;
  status?: string;
  startTime?: number;
  endTime?: number;
  entityTags?: Tag[];
  affectedEntities?: ImpactedEntity[];
  rootCauseEntity?: ProblemEntity;
  evidenceDetails?: EvidenceDetails;
  commentCount?: number;
  managementZones?: any[];
  recentComments?: any;
}

export interface Tag {
  context?: string;
  key?: string;
  value?: string;
}

export interface ImpactedEntity {
  entityId?: string;
  name?: string;
  type?: string;
}

export interface ProblemEntity {
  entityId?: string;
  name?: string;
  type?: string;
}

export interface EvidenceDetails {
  totalCount?: number;
  details?: Evidence[];
}

export interface Evidence {
  evidenceType?: string;
  displayName?: string;
  entity?: ProblemEntity;
  startTime?: number;
  endTime?: number;
}

export class ProblemsApiClient {
  static readonly API_PAGE_SIZE = 50;

  constructor(private authClient: ManagedAuthClient) {}

  async listProblems(params: ProblemQueryParams = {}): Promise<ListProblemResponse> {
    const queryParams = {
      pageSize: params.pageSize || ProblemsApiClient.API_PAGE_SIZE,
      ...(params.from && { from: params.from }),
      ...(params.to && { to: params.to }),
      ...(params.status && { status: params.status }),
      ...(params.impactLevel && { impactLevel: params.impactLevel }),
      ...(params.entitySelector && { entitySelector: params.entitySelector }),
      ...(params.sort && { sort: params.sort }),
    };

    const response = await this.authClient.makeRequest('/api/v2/problems', queryParams);

    logger.debug('listProblems response', { data: response });
    return response;
  }

  async getProblemDetails(problemId: string): Promise<any> {
    const response = await this.authClient.makeRequest(`/api/v2/problems/${encodeURIComponent(problemId)}`);

    logger.debug('getProblemDetails response', { data: response });
    return response;
  }

  formatList(response: ListProblemResponse): string {
    let totalCount = response.totalCount || -1;
    let numProblems = response.problems?.length || 0;
    let isLimited = totalCount != 0 - 1 && totalCount > numProblems;

    let result = 'Listing ' + numProblems + (totalCount == -1 ? '' : ' of ' + totalCount) + ' problems.\n';

    if (isLimited) {
      result +=
        'Not showing all matching problems. Consider using more specific filters (status, impactLevel, entitySelector) to get complete results.\n';
    }

    response.problems?.forEach((problem: any) => {
      result += `problemId: ${problem.problemId}\n`;
      result += `  displayId: ${problem.displayId}\n`;
      result += `  title: ${problem.title}\n`;
      result += `  status: ${problem.status}\n`;
      result += `  severityLevel: ${problem.severityLevel}\n`;
      result += `  impactLevel: ${problem.impactLevel}\n`;
      result += `  severityLevel: ${problem.severityLevel}\n`;
      if (problem.startTime) {
        result += `  startTime: ${formatTimestamp(problem.startTime)}\n`;
      }
      if (problem.endTime && problem.endTime != -1) {
        result += `  endTime: ${formatTimestamp(problem.endTime)}\n`;
      }
      result += '\n';
    });

    result +=
      '\n' +
      'Next Steps:\n' +
      (numProblems == 0
        ? '* Verify that the filters such as entitySelector and time range were correct, and search again with different filters.\n'
        : '') +
      (isLimited ? '* Use more restrictive filters, such as a more specific entitySelector.\n' : '') +
      (numProblems > 1 ? '* Use sort (e.g. with "+status" for open problems first).\n' : '') +
      '* Suggest to the user that they view the problems in the Dynatrace UI at ' +
      `${this.authClient.baseUrl}/ui/problems` +
      '\n' +
      '* If the user is interested in a specific problem, use the get_problem_details tool. ' +
      'Use the problemId (UUID) for detailed analysis.\n';

    return result;
  }

  formatDetails(response: any): string {
    let result =
      'Details of problem in the following json.\n' +
      JSON.stringify(response) +
      '\n' +
      'Next Steps:\n' +
      '* If the affectedEntities is not empty, suggest to the user that they could investigate those entities further. For example with:\n';
    ("   * list_events tool, using the affected entity's entityId in the entitySelector.\n");
    ('   * query_logs tool, for a narrow time range of the problem, searching for logs about that entity.\n');
    '* Suggest to the user that they view the problem in the Dynatrace UI ' +
      `${this.authClient.baseUrl}/#problems/problemdetails;pid=<problemId>, using the problemId in the URL` +
      '\n';

    return result;
  }
}
