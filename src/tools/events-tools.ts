import { z } from 'zod';
import { ToolContext } from './context';
import { GetEventDetailsArgs, ListEventsArgs } from './types';
import { EventsApiClient } from '../capabilities/events-api';
import { MAX_EVENTS_LIMIT } from './limits';

export function registerEventsTools(ctx: ToolContext): void {
  ctx.tool<ListEventsArgs>(
    'dynatrace_managed_list_events',
    `List events from the Managed cluster within a specified timeframe. Results include event properties,
    management zones, severity/impact levels, and detailed metadata for comprehensive analysis.`,
    {
      from: z.string().describe('Start time (ISO format or relative like "now-1h")'),
      to: z.string().describe('End time (ISO format or relative like "now")'),
      eventType: z
        .string()
        .optional()
        .describe(
          `Filter by event type (e.g., "CONTAINER_RESTART" for certain container issues,
          "CUSTOM_DEPLOYMENT" for deployments, "RESOURCE_CONTENTION_EVENT" for resource issues)`,
        ),
      entitySelector: z
        .string()
        .optional()
        .describe(
          `Entity selector to filter events. CRITICAL: Only ONE entity type per query.
          Use discover_entities() first to get exact names/IDs, then use entityId("exact-id") or
          type(SERVICE),entityName.equals("exact-name"). Examples: entityId("SERVICE-123"),
          type(SERVICE),entityName("payment-service"), type(AWS_LAMBDA_FUNCTION),tag("AWS_REGION:us-west-2")`,
        ),
      limit: z
        .number()
        .max(MAX_EVENTS_LIMIT)
        .optional()
        .describe(
          `Maximum number of events to return. Use this when user specifies a count (e.g., "first 20 events" → limit: 20). If not specified, returns up to API limit: ${EventsApiClient.API_PAGE_SIZE}. Cannot exceed ${MAX_EVENTS_LIMIT}`,
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
    async ({ from, to, eventType, entitySelector, limit, environment_alias }) => {
      const responses = await ctx.eventsClient.queryEvents(
        {
          from: from,
          to: to,
          eventType: eventType,
          entitySelector: entitySelector,
          pageSize: limit,
        },
        environment_alias,
      );

      return ctx.eventsClient.formatList(responses);
    },
  );

  ctx.tool<GetEventDetailsArgs>(
    'dynatrace_managed_get_event_details',
    'Get detailed information about a specific event.',
    {
      eventId: z.string().describe('The event ID to get details for'),
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
    async ({ eventId, environment_alias }) => {
      const response = await ctx.eventsClient.getEventDetails(eventId, environment_alias);
      return ctx.eventsClient.formatDetails(response);
    },
  );
}
