import { z } from 'zod';
import { ToolContext } from './context';
import { GetSecurityProblemDetailsArgs, ListSecurityProblemsArgs } from './types';
import { SecurityApiClient } from '../capabilities/security-api';

export function registerSecurityTools(ctx: ToolContext): void {
  ctx.tool<ListSecurityProblemsArgs>(
    'dynatrace_managed_list_security_problems',
    'List security problems and vulnerabilities from the Managed cluster. Results include package names, technology details, vulnerable components, and comprehensive risk assessment data.',
    {
      riskLevel: z.string().optional().describe('Filter by risk level (LOW, MEDIUM, HIGH, CRITICAL)'),
      status: z.string().optional().describe('Filter by status (OPEN, RESOLVED, MUTED)'),
      entitySelector: z
        .string()
        .optional()
        .describe(
          'Entity selector to filter vulnerabilities. CRITICAL: Only ONE entity type per query. Use discover_entities() first to get exact names/IDs, then use entityId("exact-id") or type(SERVICE),entityName.equals("exact-name"). Examples: entityId("SERVICE-123"), type(SERVICE),entityName("payment-service"), type(AWS_LAMBDA_FUNCTION),tag("AWS_REGION:us-west-2")',
        ),
      from: z.string().optional().describe('Start time (default: "now-30d")'),
      to: z.string().optional().describe('End time (default: "now")'),
      limit: z
        .number()
        .optional()
        .describe(
          `Maximum number of security problems to return. Use this when user specifies a count (e.g., "first 25 vulnerabilities" → limit: 25). If not specified, returns up to API limit: ${SecurityApiClient.API_PAGE_SIZE}`,
        ),
      sort: z
        .string()
        .optional()
        .describe(
          'Sort order. Examples: "+status" (open first), "-riskAssessment.riskScore" (highest risk first), "+firstSeenTimestamp" (newest first), "-lastUpdatedTimestamp" (recently updated first).',
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
    async ({ riskLevel, status, entitySelector, from, to, limit, sort, environment_alias }) => {
      const responses = await ctx.securityClient.listSecurityProblems(environment_alias, {
        riskLevel: riskLevel,
        status: status,
        entitySelector: entitySelector,
        from: from,
        to: to,
        pageSize: limit,
        sort: sort,
      });

      return ctx.securityClient.formatList(responses);
    },
  );

  ctx.tool<GetSecurityProblemDetailsArgs>(
    'dynatrace_managed_get_security_problem_details',
    'Get detailed information about a specific security problem including CVE details, affected entities, vulnerable components, code locations, and comprehensive technical analysis.',
    {
      securityProblemId: z
        .string()
        .describe('The security problem ID (UUID format) from list_security_problems - NOT the displayId (S-XXXXX)'),
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
    async ({ securityProblemId, environment_alias }) => {
      const response = await ctx.securityClient.getSecurityProblemDetails(securityProblemId, environment_alias);
      return ctx.securityClient.formatDetails(response);
    },
  );
}
