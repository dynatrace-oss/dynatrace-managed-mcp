import { z } from 'zod';
import { ToolContext } from './context';
import { GetProblemDetailsArgs, ListProblemsArgs } from './types';
import { ProblemsApiClient } from '../capabilities/problems-api';

export function registerProblemsTools(ctx: ToolContext): void {
  ctx.tool<ListProblemsArgs>(
    'dynatrace_managed_list_problems',
    'List problems from the Managed cluster with optional filtering.',
    {
      from: z.string().optional().describe('Start time (default: "now-24h")'),
      to: z.string().optional().describe('End time (default: "now")'),
      status: z
        .string()
        .optional()
        .describe('Problem status - use "OPEN" for active issues, "CLOSED" for resolved problems'),
      impactLevel: z
        .string()
        .optional()
        .describe(
          'Impact level - use "SERVICE" for application issues, "INFRASTRUCTURE" for host/container problems, "APPLICATION" for user-facing issues',
        ),
      entitySelector: z
        .string()
        .optional()
        .describe(
          'Entity selector to filter problems. CRITICAL: Only ONE entity type per query. Use discover_entities() first to get exact names/IDs, then use entityId("exact-id") or type(SERVICE),entityName.equals("exact-name"). Examples: entityId("SERVICE-123"), type(SERVICE),entityName("payment-service"), type(AWS_LAMBDA_FUNCTION),tag("AWS_REGION:us-west-2")',
        ),
      limit: z
        .number()
        .optional()
        .describe(
          `Maximum number of problems to return. Use this when user specifies a count (e.g., "first 10 problems" → limit: 10). If not specified, returns up to API limit: ${ProblemsApiClient.API_PAGE_SIZE}`,
        ),
      sort: z
        .string()
        .optional()
        .describe(
          'Sort order. Use "+status" (open first), "-status" (closed first), "+startTime" (old first), "-startTime" (new first), or "+relevance"/"-relevance" (with text search).',
        ),
      environment_alias: z
        .string()
        .describe(
          'Specify which environment to be queried, by supplying the environment alias as returned ' +
            'by get_environments_info. Can use `ALL_ENVIRONMENTS` to retrieve data from all environments in ' +
            'one request to MCP.',
        )
        .refine((alias) => ctx.envAliasValidate(alias), {
          message: 'Environment alias(es) not valid. Options are: ' + ctx.authClientManager.validAliases.join(', '),
        }),
    },
    {
      readOnlyHint: true,
    },
    async ({ from, to, status, impactLevel, entitySelector, limit, sort, environment_alias }) => {
      const responses = await ctx.problemsClient.listProblems(
        {
          from: from || 'now-24h',
          to: to || 'now',
          status: status,
          impactLevel: impactLevel,
          entitySelector: entitySelector,
          pageSize: limit,
          sort: sort,
        },
        environment_alias,
      );

      return ctx.problemsClient.formatList(responses);
    },
  );

  ctx.tool<GetProblemDetailsArgs>(
    'dynatrace_managed_get_problem_details',
    'Get detailed information about a specific problem including evidence details for root cause analysis, affected entities, entity tags, and management zones. Use the problemId (UUID format) from list_problems output, NOT the displayId.',
    {
      problemId: z
        .string()
        .describe('The internal problem ID (UUID format) from list_problems - NOT the displayId (P-XXXXX)'),
      environment_alias: z
        .string()
        .describe(
          'Specify which environment to be queried, by supplying the environment alias as returned ' +
            'by get_environments_info. Can use `ALL_ENVIRONMENTS` to retrieve data from all environments in ' +
            'one request to MCP.',
        )
        .refine((alias) => ctx.envAliasValidate(alias), {
          message: 'Environment alias(es) not valid. Options are: ' + ctx.authClientManager.validAliases.join(', '),
        }),
    },
    {
      readOnlyHint: true,
    },
    async ({ problemId, environment_alias }) => {
      const response = await ctx.problemsClient.getProblemDetails(problemId, environment_alias);
      return ctx.problemsClient.formatDetails(response);
    },
  );
}
