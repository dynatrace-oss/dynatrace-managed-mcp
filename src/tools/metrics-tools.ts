import { z } from 'zod';
import { ToolContext } from './context';
import { GetMetricDetailsArgs, ListAvailableMetricsArgs, QueryMetricsDataArgs } from './types';
import { MetricsApiClient } from '../capabilities/metrics-api';

export function registerMetricsTools(ctx: ToolContext): void {
  ctx.tool<ListAvailableMetricsArgs>(
    'dynatrace_managed_list_available_metrics',
    `List available metrics in the Managed cluster, optionally filtered by entity. Results include aggregation
    types, dimension definitions, and technical metadata for advanced metric analysis.`,
    {
      entitySelector: z
        .string()
        .optional()
        .describe(
          `Entity selector to filter metrics. Must use at most one entity type per query.
          Examples include:
           * type(SERVICE)
           * entityId("id1","id2")
           * type(HOST)
          Can combine with things like: entityName.contains("name"), tag("key:value"), mzName("zone").`,
        ),
      searchText: z
        .string()
        .optional()
        .describe(
          `Text to search for in metric names and descriptions.
          **RECOMMENDED SEARCHES**: "response.time" (latency), "cpu.usage" (CPU), "memory" (memory),
          "error.rate" (errors), "throughput" (performance), "availability" (uptime)`,
        ),
      limit: z
        .number()
        .optional()
        .describe(
          `Maximum number of metrics to return. Use this when user specifies a count
          (e.g., "first 16 metrics" → limit: 16, "500 metrics" → limit: 500).
          If not specified, returns up to API limit: ${MetricsApiClient.API_PAGE_SIZE}`,
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
    async ({ entitySelector, searchText, limit, environment_alias }) => {
      const responses = await ctx.metricsClient.listAvailableMetrics(environment_alias, {
        entitySelector: entitySelector,
        text: searchText,
        pageSize: limit,
      });
      return ctx.metricsClient.formatMetricList(responses);
    },
  );

  ctx.tool<QueryMetricsDataArgs>(
    'dynatrace_managed_query_metrics_data',
    `Query metric data for a specific time range and metric selector.
    Must limit the amount of data being retrieved:
    must use a specific entitySelector, such as using specific entityIds;
    must use a narrow timerange (with from and to);
    must use a resolution in line with the timerange, for example if getting data covering several days then the resolution should be hours rather than minutes.`,
    {
      metricSelector: z.string().describe(
        `Metric selector (e.g., "builtin:service.response.time" for latency,
        "builtin:tech.generic.cpu.usage" for container CPU, "builtin:host.mem.usage" for memory).
        Consider first using the tool list_available_metrics to identity the right metric.`,
      ),
      from: z.string().describe('Start time (ISO format or relative like "now-1h")'),
      to: z.string().describe('End time (ISO format or relative like "now")'),
      resolution: z
        .string()
        .optional()
        .describe(
          `Data resolution. Use a bigger resolution when the timerange is larger.
          For example, use "5m" for detailed analysis of data over hour(s), use "1h" for trends of data over a day, use 6h or 1d for data over many days.`,
        ),
      entitySelector: z
        .string()
        .optional()
        .describe(
          `Entity selector to filter metrics data. CRITICAL: Only ONE entity type per query.
          Use discover_entities() first to get exact names/IDs, then use entityId("exact-id") or
          type(SERVICE),entityName.equals("exact-name"). Examples: entityId("SERVICE-123"),
          type(SERVICE),entityName("payment-service"), type(AWS_LAMBDA_FUNCTION),tag("AWS_REGION:us-west-2")`,
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
    async ({ metricSelector, from, to, resolution, entitySelector, environment_alias }) => {
      const responses = await ctx.metricsClient.queryMetrics(
        {
          metricSelector: metricSelector,
          from: from,
          to: to,
          resolution: resolution,
          entitySelector: entitySelector,
        },
        environment_alias,
      );

      return ctx.metricsClient.formatMetricData(responses);
    },
  );

  ctx.tool<GetMetricDetailsArgs>(
    'dynatrace_managed_get_metric_details',
    'Get detailed information about a specific metric.',
    {
      metricId: z.string().describe('The metric ID to get details for'),
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
    async ({ metricId, environment_alias }) => {
      const responses = await ctx.metricsClient.getMetricDetails(metricId, environment_alias);
      return ctx.metricsClient.formatMetricDetails(responses);
    },
  );
}
