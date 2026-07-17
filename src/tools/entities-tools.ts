import { z } from 'zod';
import { ToolContext } from './context';
import {
  DiscoverEntitiesArgs,
  EnvironmentScopedArgs,
  GetEntityDetailsArgs,
  GetEntityRelationshipsArgs,
  GetEntityTypeDetailsArgs,
} from './types';
import { EntitiesApiClient } from '../capabilities/entities-api';

export function registerEntitiesTools(ctx: ToolContext): void {
  ctx.tool<EnvironmentScopedArgs>(
    'dynatrace_managed_list_entity_types',
    'List all available entity types in the Managed cluster to understand what types of entities can be monitored.',
    {
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
    async ({ environment_alias }) => {
      const responses = await ctx.entitiesClient.listEntityTypes(environment_alias);
      return ctx.entitiesClient.formatEntityTypeList(responses);
    },
  );

  ctx.tool<GetEntityTypeDetailsArgs>(
    'dynatrace_managed_get_entity_type_details',
    'Get details of an entity type.',
    {
      type: z.string().describe('Name of the entity type, such as SERVICE, APPLICATION, HOST, etc'),
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
    async ({ type, environment_alias }) => {
      const response = await ctx.entitiesClient.getEntityTypeDetails(type, environment_alias);
      return ctx.entitiesClient.formatEntityTypeDetails(response);
    },
  );

  ctx.tool<DiscoverEntitiesArgs>(
    'dynatrace_managed_discover_entities',
    `Discover entities in the Managed cluster using EntitySelector syntax. REQUIRED: Must specify
    entitySelector with exactly ONE entity type only. Results include entity properties, tags,
    management zones, and relationship counts for comprehensive topology analysis.`,
    {
      entitySelector: z.string().describe(
        `Entity selector to filter the entities. CRITICAL: Must include exactly ONE entity type
          like type("SERVICE") - multiple types NOT supported. Examples: type("SERVICE"),
          entityId("ID1"), entityName.contains("name"), entityName.equals("exact"), tag("key:value"), mzName("zone"),
          healthState("HEALTHY").`,
      ),
      mzSelector: z
        .string()
        .optional()
        .describe(
          `Optional management zone selector to further scope the query. Use mzId(123,456) for zone IDs
          or mzName("Bookstore-FS","Stocks") for zone names. Can combine: mzId(123),mzName("Production").
          Works alongside entitySelector.`,
        ),
      from: z
        .string()
        .optional()
        .describe('Start time for entity observation timeframe (ISO format or relative like "now-3d")'),
      to: z
        .string()
        .optional()
        .describe('End time for entity observation timeframe (ISO format or relative like "now")'),
      limit: z
        .number()
        .optional()
        .describe(
          `Maximum number of entities to return. Use this when user specifies a count (e.g., "first 10 entities" → limit: 10). If not specified, returns up to API limit: ${EntitiesApiClient.API_PAGE_SIZE}`,
        ),
      sort: z
        .string()
        .optional()
        .describe('Sort order for entities. Use "name" for ascending, "-name" for descending by display name.'),
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
    async ({ entitySelector, mzSelector, from, to, limit, sort, environment_alias }) => {
      const responses = await ctx.entitiesClient.queryEntities(
        {
          entitySelector: entitySelector,
          pageSize: limit,
          mzSelector: mzSelector,
          from: from,
          to: to,
          sort: sort,
        },
        environment_alias,
      );
      return ctx.entitiesClient.formatEntityList(responses);
    },
  );

  ctx.tool<GetEntityDetailsArgs>(
    'dynatrace_managed_get_entity_details',
    'Get detailed information about a specific entity.',
    {
      entityId: z.string().describe('The entity ID to get details for'),
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
    async ({ entityId, environment_alias }) => {
      const response = await ctx.entitiesClient.getEntityDetails(entityId, environment_alias);
      return ctx.entitiesClient.formatEntityDetails(response);
    },
  );

  ctx.tool<GetEntityRelationshipsArgs>(
    'dynatrace_managed_get_entity_relationships',
    'Get relationships that a specific entity has "to" and "from" other entities.',
    {
      entityId: z.string().describe('The entity ID to get relationships for'),
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
    async ({ entityId, environment_alias }) => {
      const responses = await ctx.entitiesClient.getEntityRelationships(entityId, environment_alias);
      return ctx.entitiesClient.formatEntityRelationships(responses);
    },
  );
}
