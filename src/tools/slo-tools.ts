import { z } from 'zod';
import { ToolContext } from './context';
import { GetSloDetailsArgs, ListSlosArgs } from './types';
import { SloApiClient } from '../capabilities/slo-api';

export function registerSloTools(ctx: ToolContext): void {
  ctx.tool<ListSlosArgs>(
    'dynatrace_managed_list_slos',
    'List Service Level Objectives (SLOs) from the Managed cluster. Results include timeframe details, management zones, error budget burn rates, and comprehensive SLO configuration data. IMPORTANT: When evaluate=true, the query must be limited to 25 or fewer results using the limit parameter.',
    {
      sloSelector: z
        .string()
        .optional()
        .describe(
          'SLO selector to filter results. Syntax: id("id-1","id-2") for SLO IDs, name("Service Availability") for exact name match (case-sensitive), healthState("HEALTHY"|"UNHEALTHY") [requires evaluate=true], text("value") for case-insensitive text search, problemDisplayName("P-12345") for problem display names, managementZone("MZ-A") or managementZoneID("123") for management zones. Combine with commas. Escape special characters ~ and " with ~.',
        ),
      timeFrame: z
        .string()
        .optional()
        .describe(
          'Time frame for SLO evaluation: "CURRENT" for SLO\'s own timeframe, "GTF" for custom timeframe specified by from/to parameters',
        ),
      from: z
        .string()
        .optional()
        .describe('Start time (ISO format or relative like "now-2w"). Used when timeFrame="GTF"'),
      to: z.string().optional().describe('End time (ISO format or relative like "now"). Used when timeFrame="GTF"'),
      evaluate: z
        .boolean()
        .optional()
        .describe('Set to true to enable SLO evaluation. Required when using healthState in sloSelector.'),
      sort: z
        .string()
        .optional()
        .describe('Sorting of SLO entries: "name" for ascending order, "-name" for descending order. Default: "name"'),
      enabledSlos: z
        .string()
        .optional()
        .describe(
          'Filter by SLO status: "true" for enabled SLOs only, "false" for disabled only, "all" for both. Default: "true"',
        ),
      showGlobalSlos: z
        .boolean()
        .optional()
        .describe('Include global SLOs in results regardless of other filters. Default: true'),
      demo: z.boolean().optional().describe('Get demo SLOs instead of real ones. Default: false'),
      limit: z
        .number()
        .optional()
        .describe(
          `Maximum number of SLOs to return. Use this when user specifies a count (e.g., "first 15 SLOs" → limit: 15). If not specified, returns up to API limit: ${SloApiClient.API_PAGE_SIZE}`,
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
    async ({
      sloSelector,
      timeFrame,
      from,
      to,
      evaluate,
      sort,
      enabledSlos,
      showGlobalSlos,
      demo,
      limit,
      environment_alias,
    }) => {
      const responses = await ctx.sloClient.listSlos(environment_alias, {
        sloSelector: sloSelector,
        timeFrame: timeFrame,
        from: from,
        to: to,
        evaluate: evaluate,
        sort: sort,
        enabledSlos: enabledSlos,
        showGlobalSlos: showGlobalSlos,
        demo: demo,
        pageSize: limit,
      });
      return ctx.sloClient.formatList(responses);
    },
  );

  ctx.tool<GetSloDetailsArgs>(
    'dynatrace_managed_get_slo_details',
    'Get detailed information about a specific SLO.',
    {
      sloId: z.string().describe('The SLO ID to get details for'),
      from: z
        .string()
        .optional()
        .describe('Start time (ISO format or relative like "now-1w"). Used when timeFrame="GTF"'),
      to: z.string().optional().describe('End time (ISO format or relative like "now"). Used when timeFrame="GTF"'),
      timeFrame: z
        .string()
        .optional()
        .describe(
          'Time frame for SLO evaluation: "CURRENT" for SLO\'s own timeframe, "GTF" for custom timeframe specified by from and to parameters',
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
    async ({ sloId, from, to, timeFrame, environment_alias }) => {
      const response = await ctx.sloClient.getSloDetails(
        {
          id: sloId,
          from: from,
          to: to,
          timeFrame: timeFrame,
        },
        environment_alias,
      );
      return ctx.sloClient.formatDetails(response);
    },
  );
}
