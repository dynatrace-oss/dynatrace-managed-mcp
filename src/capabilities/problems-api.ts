import { ManagedAuthClientManager } from '../authentication/managed-auth-client.js';
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

  constructor(private readonly authManager: ManagedAuthClientManager) {}

  async listProblems(
    params: ProblemQueryParams = {},
    environment_aliases: string,
  ): Promise<Map<string, ListProblemResponse>> {
    const queryParams = {
      pageSize: params.pageSize || ProblemsApiClient.API_PAGE_SIZE,
      ...(params.from && { from: params.from }),
      ...(params.to && { to: params.to }),
      ...(params.status && { status: params.status }),
      ...(params.impactLevel && { impactLevel: params.impactLevel }),
      ...(params.entitySelector && { entitySelector: params.entitySelector }),
      ...(params.sort && { sort: params.sort }),
    };

    const responses = await this.authManager.makeRequests<ListProblemResponse>(
      '/api/v2/problems',
      queryParams,
      environment_aliases,
    );

    logger.debug('listProblems response', { data: responses });
    return responses;
  }

  async getProblemDetails(problemId: string, environment_aliases: string): Promise<Map<string, Problem>> {
    const responses = await this.authManager.makeRequests<Problem>(
      `/api/v2/problems/${encodeURIComponent(problemId)}`,
      {},
      environment_aliases,
    );

    logger.debug('getProblemDetails response', { data: responses });
    return responses;
  }

  formatList(responses: Map<string, ListProblemResponse>): string {
    let result = '';
    let totalNumProblems = 0;
    let anyLimited = false;
    const aliases: string[] = [];
    for (const [alias, data] of responses) {
      aliases.push(alias);
      const totalCount = data.totalCount || -1;
      const numProblems = data.problems?.length || 0;
      totalNumProblems += numProblems;
      const isLimited = totalCount != 0 - 1 && totalCount > numProblems;

      result +=
        'Listing ' +
        numProblems +
        (totalCount == -1 ? '' : ' of ' + totalCount) +
        ' problems from environment ' +
        alias +
        '.\n\n';

      if (isLimited) {
        result +=
          'Not showing all matching problems. Consider using more specific filters (status, impactLevel, entitySelector) to get complete results.\n';
        anyLimited = true;
      }

      data.problems?.forEach((problem: Problem) => {
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
    }

    result +=
      '\n' +
      'Next Steps:\n' +
      (totalNumProblems == 0
        ? '* Verify that the filters such as entitySelector and time range were correct, and search again with different filters.\n'
        : '') +
      (anyLimited ? '* Use more restrictive filters, such as a more specific entitySelector.\n' : '') +
      (totalNumProblems > 1 ? '* Use sort (e.g. with "+status" for open problems first).\n' : '') +
      '* Suggest to the user that they view the problems in the Dynatrace UI';

    const baseUrl = aliases.length == 1 ? this.authManager.getBaseUrl(aliases[0]) : '';

    result +=
      (baseUrl ? ` at ${baseUrl}/ui/problems.` : '.') +
      '\n* If the user is interested in a specific problem, use the get_problem_details tool. ' +
      'Use the problemId (UUID) for detailed analysis.\n';

    return result;
  }

  formatDetails(responses: Map<string, Problem>): string {
    let result = '';
    const aliases: string[] = [];
    for (const [alias, data] of responses) {
      aliases.push(alias);
      result +=
        'Details of problem from environment ' + alias + ' in the following json:\n' + JSON.stringify(data) + '\n';
    }
    const baseUrl = aliases.length == 1 ? this.authManager.getBaseUrl(aliases[0]) : '';
    result +=
      'Next Steps:\n' +
      '* If the affectedEntities is not empty, suggest to the user that they could investigate those entities further. For example with:\n' +
      "   * list_events tool, using the affected entity's entityId in the entitySelector.\n" +
      '   * query_logs tool, for a narrow time range of the problem, searching for logs about that entity.\n' +
      '   * Suggest to the user that they view the problem in the Dynatrace UI' +
      (baseUrl ? ` at ${baseUrl}/#problems/problemdetails;pid=<problemId>, using the problemId in the URL` : '.');

    return result;
  }
}
