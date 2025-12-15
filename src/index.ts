#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { Command } from 'commander';
import { z, ZodRawShape, ZodTypeAny } from 'zod';
import { getPackageJsonVersion } from './utils/version';
import { ManagedAuthClient } from './authentication/managed-auth-client';
import { getManagedEnvironmentConfig } from './utils/environment';
import { createTelemetry, Telemetry } from './utils/telemetry-openkit';
import { MetricsApiClient } from './capabilities/metrics-api';
import { LogsApiClient } from './capabilities/logs-api';

import { EventsApiClient } from './capabilities/events-api';
import { EntitiesApiClient } from './capabilities/entities-api';
import { ProblemsApiClient } from './capabilities/problems-api';
import { SecurityApiClient } from './capabilities/security-api';
import { SloApiClient } from './capabilities/slo-api';

// Import logger after environment is loaded
import { logger } from './utils/logger';

logger.info('Starting Dynatrace Managed MCP');

// Required API scopes for Managed deployment
const MANAGED_API_SCOPES = [
  'DataExport', // Read metrics and topology
  'ReadConfig', // Read configuration and cluster version
  'ReadSyntheticData', // Read synthetic monitoring data
  'ReadLogContent', // Read log content
  'ReadEvents', // Read events
  'ReadProblems', // Read problems and root cause analysis
  'ReadSecurityProblems', // Read security problems
  'ReadSLO', // Read Service Level Objectives
];

// Rate limiting state: store timestamps of tool calls
let toolCallTimestamps: number[] = [];

const main = async () => {
  logger.info(`Initializing Dynatrace Managed MCP Server v${getPackageJsonVersion()}...`);

  // Read Managed environment configuration
  let managedConfig;
  try {
    managedConfig = getManagedEnvironmentConfig();
  } catch (err) {
    console.error('Failed to get managed environment configuration', err);
    logger.error('Failed to get managed environment configuration', { error: err });
    process.exit(1);
  }

  const { environment, apiToken } = managedConfig;

  // Initialize Managed authentication client
  const authClient = new ManagedAuthClient(environment, apiToken);

  // Initialize API clients
  const metricsClient = new MetricsApiClient(authClient);
  const logsClient = new LogsApiClient(authClient);
  const eventsClient = new EventsApiClient(authClient);
  const entitiesClient = new EntitiesApiClient(authClient);
  const problemsClient = new ProblemsApiClient(authClient);
  const securityClient = new SecurityApiClient(authClient);
  const sloClient = new SloApiClient(authClient);

  // Initialize usage tracking
  const telemetry = createTelemetry();
  await telemetry.trackMcpServerStart();

  // Create a shutdown handler that takes shutdown operations as parameters
  const shutdownHandler = (...shutdownOps: Array<() => void | Promise<void>>) => {
    return async () => {
      logger.info('Shutting down MCP server...');
      for (const op of shutdownOps) {
        await op();
      }
      process.exit(0);
    };
  };

  // Initialize Metadata for MCP Server
  const server = new McpServer(
    {
      name: 'Dynatrace Managed MCP Server',
      version: getPackageJsonVersion(),
    },
    {
      capabilities: {
        tools: {},
        elicitation: {},
      },
      instructions: `
This MCP server connects to a Dynatrace Managed (self-hosted) environment for Observabilitiy. This can include metrics, logs and traces,
and detection of problems and security vulnerabilities relating to these.

Some users may configure two MCPs at the same time: this MCP to connect to their Dynatrace Managed, and a second MCP to connect to their SaaS environment.
Be careful of which MCP to use. If it is unclear, ask the user which they want to use. Ask the user to confirm the difference between their two environments.

**Key Context:**
- This server accesses self-hosted Dynatrace Managed clusters (not the SaaS environment)
- Designed for historical data analysis before migration to SaaS
- Minimum supported cluster version: ${authClient.MINIMUM_VERSION}
- Two different ways that Dynatrace Managed may be being used:
   1. Dynatrace Managed may be the primary Observability system, containing all live data.
   2. Or alternatively the customer may have migrated to Dynatrace SaaS, leavng historical observability data in Dynatrace Managed from before the migration, in which case this MCP Server would only be used to access historical data.

**Core Capabilities:**
- **Problem Analysis**: Investigate problems with root cause identification
- **Security Assessment**: Comprehensive vulnerability scanning and risk assessment
- **Log Investigation**: Search logs using either simple text search or advanced query syntax with time-based filtering
- **Event Tracking**: Monitor system events, deployments, and configuration changes
- **Entity Exploration**: Discover and analyze monitored entities, including relationship mapping
- **Metrics Analysis**: Query observability metrics via the Dynatrace Metrics V2 API
- **SLO Management**: Service Level Objective monitoring, error budget analysis, and SLO evaluation tracking

**Best Practices:**
- Use specific time ranges (1-2 hours) rather than large historical queries for better performance
- Leverage entity selectors to filter data at the source - they are fundamental to getting good results
- Use problem IDs (UUID format) from list_problems, not display IDs (P-XXXXX)
- Start with get_environment_info to understand cluster capabilities and data range
- **When users specify counts** (e.g., "first 25 errors", "50 metrics", "100 errors"), always use the "limit" parameter in tools rather than guessing with searchText
- **Avoid searchText guessing** - only use searchText when user explicitly mentions keywords to search for
- **discover_entities ALWAYS requires entitySelector** - never call this tool without providing an entitySelector with exactly ONE entity type like type("SERVICE") unless using an EntityId. Multiple entity types are NOT supported.

**Time Range Parameters:**
- **Relative Times**: now-1h, now-24h, now-7d, now-30d (h=hours, d=days, m=minutes, s=seconds)
- **ISO Format**: 2024-01-01T10:00:00Z or 2024-01-01T10:00:00
- **Unix Timestamps**: 1640995200000 (milliseconds since epoch)
- **Common Patterns**:
  - "last hour" → from: "now-1h", to: "now"
  - "past 24 hours" → from: "now-24h", to: "now"
  - "last week" → from: "now-7d", to: "now"
  - "yesterday" → from: "now-24h", to: "now-0h"
  - "last 6 hours" → from: "now-6h", to: "now"
  - "past 30 minutes" → from: "now-30m", to: "now"

**Entity Selector Guidelines**
- **CRITICAL CONSTRAINT**: You can select only ONE entity type per query. Multiple entity types are NOT supported in a single query.
- **Key Rule**: Dynatrace Managed requires type() specification unless using entityId() with full IDs
- **For multiple specific entity ids**: Use entityId("ID1","ID2","ID3") with comma-separated IDs (all entities must be same type); must never combine multiple entityId selectors with OR
- **For name-based filtering**: Use type("SERVICE"),entityName("exact-name") or type("SERVICE"),entityName.contains("partial")
- **To set several criteria, separate them with a comma. For example, type("HOST"),healthState("HEALTHY"). Only results matching all criteria are included in the response.
- Example Valid Entity Selectors:
   - type("SERVICE"),entityName.contains("bookstore")
   - entityId("SERVICE-123","SERVICE-456","SERVICE-789")
   - entityId("SERVICE-1234567890ABCDEF")
   - type("AWS_LAMBDA_FUNCTION"),tag("AWS_REGION:us-west-2")
   - type("SERVICE"),tag("environment:production"),entityName.contains("api")
   - type("HOST"),mzName("Production")
- Example INVALID Entity Selectors (NEVER USE THESE):**
   - type(SERVICE),type(PROCESS_GROUP) - Invalid because supports only one type per query
   - entityName("my-service") - Invalid because type must be defined if an explicit entityId is not specified
   - entityId("ID1") or entityId("ID2") - OR operator not supported for entityId criteria, instead use a single criteria with entityId("ID1","ID2")

**Log Search Guidelines:**
- Simple query: specify the text to search for, such as "error". This search is case-insensitive.
- More complex queries: you can specify that the text should be part of the content of the log message, with: content="error"
  This critiera can be combined with more other search criteria, such as: content="error" AND dt.entity.host="HOST-94A1B472D04D89D9"

**Common Workflows:**

For problem or incident investigation:
 1. list_problems
 2. get_problem_details

For security Assessment:
 1. list_security_problems
 2. get_security_problem_details

For SLO Analysis:
 1. list_slos
 2. get_slo_details

For entity-based Analysis:
 1. list_entity_types
 2. discover_entities (ALWAYS with entitySelector)
 3. get_entity_details (using use exact entityId)
 4. list_problems or list_events, using the entityId in the entitySelector.

Always be cautious to avoid overloading the self-hosted Dynatrace Managed clusters. 
Never run queries that could return very large amounts of data, or that could be very expensive to compute.
`,
    },
  );

  // Test connection to Managed cluster
  logger.info(`Testing connection to Dynatrace Managed cluster: ${environment}...`);

  try {
    const isConnected = await authClient.validateConnection();
    if (!isConnected) {
      throw new Error('Connection validation failed');
    }
    logger.info(`Called validateConnection`);

    const clusterVersion = await authClient.getClusterVersion();
    logger.info(`Connected to Managed cluster version ${clusterVersion.version}`);

    const isValidVersion = authClient.validateMinimumVersion(clusterVersion);
    if (!isValidVersion) {
      logger.info(
        `Warning: Cluster version ${clusterVersion.version} may not support all features. Minimum recommended version is${authClient.MINIMUM_VERSION}`,
      );
    }
  } catch (error: any) {
    logger.error(`Failed to connect to Managed cluster ${environment}: ${error.message}`);
    logger.error('Please verify:');
    logger.error('1. DT_MANAGED_ENVIRONMENT URL is correct');
    logger.error(`2. DT_MANAGED_API_TOKEN has required scopes: ${MANAGED_API_SCOPES.join(', ')}`);
    logger.error('3. Network connectivity to the Managed cluster');

    process.exit(2);
  }

  // Ready to start the server
  logger.info(`Starting Dynatrace Managed MCP Server v${getPackageJsonVersion()}...`);

  // Tool wrapper for consistent error handling and telemetry
  const tool = (
    name: string,
    description: string,
    paramsSchema: ZodRawShape,
    annotations: ToolAnnotations,
    cb: (args: z.objectOutputType<ZodRawShape, ZodTypeAny>) => Promise<string>,
  ) => {
    const wrappedCb = async (args: any): Promise<CallToolResult> => {
      // Capture starttime for telemetry and rate limiting
      const startTime = Date.now();

      /**
       * Rate Limit: Max. 5 requests per 20 seconds.
       */
      const twentySecondsAgo = startTime - 20000;

      // First, remove all tool calls older than 20s
      toolCallTimestamps = toolCallTimestamps.filter((ts) => ts > twentySecondsAgo);

      // Second, check whether we have 5 or more calls in the past 20s
      if (toolCallTimestamps.length >= 5) {
        logger.debug(`Rate-limiting tool execution: ${name}; args: ${JSON.stringify(args)}`);
        return {
          content: [
            { type: 'text', text: 'Rate limit exceeded: Maximum 5 tool calls per 20 seconds. Please try again later.' },
          ],
          isError: true,
        };
      }

      // Last but not least, record this call
      toolCallTimestamps.push(startTime);
      /** Rate Limit End */

      let toolCallSuccessful = false;

      try {
        logger.debug(`Executing tool: ${name}; args: ${JSON.stringify(args)}`);
        const response = await cb(args);
        toolCallSuccessful = true;
        logger.debug(
          `Executed tool: ${name}; args: ${JSON.stringify(args)}; response length ${response.length} chars; ${response}`,
        );
        return {
          content: [{ type: 'text', text: response }],
        };
      } catch (error: any) {
        telemetry
          .trackError(error, `tool_${name}`)
          .catch((e) => logger.warn(`Failed to track error: ${e.message}`, { error: e }));
        logger.error(`Failed to run tool ${name}: ${error.message}`, { error: error });
        logger.error(error);
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      } finally {
        const duration = Date.now() - startTime;
        telemetry
          .trackMcpToolUsage(name, toolCallSuccessful, duration)
          .catch((e) => logger.warn(`Failed to track tool usage: ${e.message}`, { error: e }));
      }
    };

    server.registerTool(name, { description: description }, (args: any) => wrappedCb(args));
  };

  tool(
    'dynatrace_managed_get_environment_info',
    'Get information about the connected Dynatrace Managed cluster and verify the connection and authentication.',
    {},
    {
      readOnlyHint: true,
    },
    async ({}) => {
      const clusterVersion = await authClient.getClusterVersion();
      const isValidVersion = authClient.validateMinimumVersion(clusterVersion);

      let resp = `Dynatrace Managed Cluster Information:\n`;
      resp += `- URL: ${environment}\n`;
      resp += `- Version: ${clusterVersion.version}\n`;
      resp += `- Minimum Version Check: ${isValidVersion ? 'PASSED' : 'WARNING - Version may not be fully compatible and may not support all features'}\n`;
      resp += `- Available API Scopes: ${MANAGED_API_SCOPES.join(', ')}\n`;

      return resp;
    },
  );

  tool(
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
    },
    {
      readOnlyHint: true,
    },
    async ({ entitySelector, searchText, limit }) => {
      const response = await metricsClient.listAvailableMetrics({
        entitySelector: entitySelector,
        text: searchText,
        pageSize: limit,
      });
      return metricsClient.formatMetricList(response);
    },
  );

  tool(
    'dynatrace_managed_query_metrics_data',
    `Query metric data for a specific time range and metric selector.
    Must limit the amount of data being retreived: 
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
    },
    {
      readOnlyHint: true,
    },
    async ({ metricSelector, from, to, resolution, entitySelector }) => {
      const response = await metricsClient.queryMetrics({
        metricSelector: metricSelector,
        from: from,
        to: to,
        resolution: resolution,
        entitySelector: entitySelector,
      });

      return metricsClient.formatMetricData(response);
    },
  );

  tool(
    'dynatrace_managed_get_metric_details',
    'Get detailed information about a specific metric.',
    {
      metricId: z.string().describe('The metric ID to get details for'),
    },
    {
      readOnlyHint: true,
    },
    async ({ metricId }) => {
      const response = await metricsClient.getMetricDetails(metricId);
      return metricsClient.formatMetricDetails(response);
    },
  );

  tool(
    'dynatrace_managed_query_logs',
    `Search logs using simple text queries. Results include event types, expanded metadata fields 
    (up to 8 fields), and enhanced error detection. Managed clusters support basic text search but 
    not structured syntax like "content:" or "loglevel:".`,
    {
      query: z.string().describe(
        `Simple text to search for in log content (e.g., "error", "exception", "timeout"). 
          Do NOT use structured syntax like "content:error" - just use "error".`,
      ),
      from: z.string().describe('Start time (ISO format or relative like "now-1h")'),
      to: z.string().describe('End time (ISO format or relative like "now")'),
      limit: z.number().optional().describe('Maximum number of logs to return (default: 100)'),
      sort: z.string().optional().describe('Sort order for logs. Use "-timestamp" for most recent first.'),
    },
    {
      readOnlyHint: true,
    },
    async ({ query, from, to, limit, sort }) => {
      const response = await logsClient.queryLogs({
        query: query,
        from: from,
        to: to,
        limit: limit,
        sort: sort,
      });
      return logsClient.formatList(response);
    },
  );

  tool(
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
        .optional()
        .describe(
          `Maximum number of events to return. Use this when user specifies a count (e.g., "first 20 events" → limit: 20). If not specified, returns up to API limit: ${EventsApiClient.API_PAGE_SIZE}`,
        ),
    },
    {
      readOnlyHint: true,
    },
    async ({ from, to, eventType, entitySelector, limit }) => {
      const response = await eventsClient.queryEvents({
        from: from,
        to: to,
        eventType: eventType,
        entitySelector: entitySelector,
        pageSize: limit,
      });

      return eventsClient.formatList(response);
    },
  );

  tool(
    'dynatrace_managed_get_event_details',
    'Get detailed information about a specific event.',
    {
      eventId: z.string().describe('The event ID to get details for'),
    },
    {
      readOnlyHint: true,
    },
    async ({ eventId }) => {
      const response = await eventsClient.getEventDetails(eventId);
      return eventsClient.formatDetails(response);
    },
  );

  tool(
    'dynatrace_managed_list_entity_types',
    'List all available entity types in the Managed cluster to understand what types of entities can be monitored.',
    {},
    {
      readOnlyHint: true,
    },
    async ({}) => {
      const response = await entitiesClient.listEntityTypes();
      return entitiesClient.formatEntityTypeList(response);
    },
  );

  tool(
    'dynatrace_managed_get_entity_type_details',
    'Get details of an entity type.',
    {
      type: z.string().describe('Name of the entity type, such as SERVICE, APPLICATION, HOST, etc'),
    },
    {
      readOnlyHint: true,
    },
    async ({ type }) => {
      const response = await entitiesClient.getEntityTypeDetails(type);
      return entitiesClient.formatEntityTypeDetails(response);
    },
  );

  tool(
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
    },
    {
      readOnlyHint: true,
    },
    async ({ entitySelector, mzSelector, from, to, limit, sort }) => {
      const response = await entitiesClient.queryEntities({
        entitySelector: entitySelector,
        pageSize: limit,
        mzSelector: mzSelector,
        from: from,
        to: to,
        sort: sort,
      });
      return entitiesClient.formatEntityList(response);
    },
  );

  tool(
    'dynatrace_managed_get_entity_details',
    'Get detailed information about a specific entity.',
    {
      entityId: z.string().describe('The entity ID to get details for'),
    },
    {
      readOnlyHint: true,
    },
    async ({ entityId }) => {
      const response = await entitiesClient.getEntityDetails(entityId);
      return entitiesClient.formatEntityDetails(response);
    },
  );

  tool(
    'dynatrace_managed_get_entity_relationships',
    'Get relationships that a specific entity has "to" and "from" other entities.',
    {
      entityId: z.string().describe('The entity ID to get relationships for'),
    },
    {
      readOnlyHint: true,
    },
    async ({ entityId }) => {
      const response = await entitiesClient.getEntityRelationships(entityId);
      return entitiesClient.formatEntityRelationships(response);
    },
  );

  tool(
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
    },
    {
      readOnlyHint: true,
    },
    async ({ from, to, status, impactLevel, entitySelector, limit, sort }) => {
      const response = await problemsClient.listProblems({
        from: from || 'now-24h',
        to: to || 'now',
        status: status,
        impactLevel: impactLevel,
        entitySelector: entitySelector,
        pageSize: limit,
        sort: sort,
      });

      return problemsClient.formatList(response);
    },
  );

  tool(
    'dynatrace_managed_get_problem_details',
    'Get detailed information about a specific problem including evidence details for root cause analysis, affected entities, entity tags, and management zones. Use the problemId (UUID format) from list_problems output, NOT the displayId.',
    {
      problemId: z
        .string()
        .describe('The internal problem ID (UUID format) from list_problems - NOT the displayId (P-XXXXX)'),
    },
    {
      readOnlyHint: true,
    },
    async ({ problemId }) => {
      const response = await problemsClient.getProblemDetails(problemId);
      return problemsClient.formatDetails(response);
    },
  );

  tool(
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
    },
    {
      readOnlyHint: true,
    },
    async ({ riskLevel, status, entitySelector, from, to, limit, sort }) => {
      const response = await securityClient.listSecurityProblems({
        riskLevel: riskLevel,
        status: status,
        entitySelector: entitySelector,
        from: from,
        to: to,
        pageSize: limit,
        sort: sort,
      });

      return securityClient.formatList(response);
    },
  );

  tool(
    'dynatrace_managed_get_security_problem_details',
    'Get detailed information about a specific security problem including CVE details, affected entities, vulnerable components, code locations, and comprehensive technical analysis.',
    {
      securityProblemId: z
        .string()
        .describe('The security problem ID (UUID format) from list_security_problems - NOT the displayId (S-XXXXX)'),
    },
    {
      readOnlyHint: true,
    },
    async ({ securityProblemId }) => {
      const response = await securityClient.getSecurityProblemDetails(securityProblemId);
      return securityClient.formatDetails(response);
    },
  );

  tool(
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
    },
    {
      readOnlyHint: true,
    },
    async ({ sloSelector, timeFrame, from, to, evaluate, sort, enabledSlos, showGlobalSlos, demo, limit }) => {
      const response = await sloClient.listSlos({
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
      return sloClient.formatList(response);
    },
  );

  tool(
    'dynatrace_managed_get_slo_details',
    'Get detailed information about a specific SLO.',
    {
      sloId: z.string().describe('The SLO ID to get details for'),
      from: z
        .string()
        .optional()
        .describe('Start time (ISO format or relative like "now-1w"). Used when timeFrame="GTF"'),
      end: z.string().optional().describe('End time (ISO format or relative like "now"). Used when timeFrame="GTF"'),
      timeFrame: z
        .string()
        .optional()
        .describe(
          'Time frame for SLO evaluation: "CURRENT" for SLO\'s own timeframe, "GTF" for custom timeframe specified by from and to parameters',
        ),
    },
    {
      readOnlyHint: true,
    },
    async ({ sloId, from, to, timeFrame }) => {
      const response = await sloClient.getSloDetails({
        id: sloId,
        from: from,
        to: to,
        timeFrame: timeFrame,
      });
      return sloClient.formatDetails(response);
    },
  );

  // Parse command line arguments using commander
  const program = new Command();

  program
    .name('dynatrace-managed-mcp')
    .description('Dynatrace Managed Model Context Protocol (MCP) Server')
    .version(getPackageJsonVersion())
    .option('--http', 'enable HTTP server mode instead of stdio')
    .option('--server', 'enable HTTP server mode (alias for --http)')
    .option('-p, --port <number>', 'port for HTTP server', '3000')
    .option('-H, --host <host>', 'host for HTTP server', '127.0.0.1')
    .parse();

  const options = program.opts();
  const httpMode = options.http || options.server;
  const httpPort = parseInt(options.port, 10);
  const host = options.host || '127.0.0.1';

  // HTTP server mode (Stateless)
  if (httpMode) {
    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      // Parse request body for POST requests
      let body: unknown;
      // Create a new Stateless HTTP Transport
      const httpTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // No Session ID needed
      });

      res.on('close', () => {
        // close transport and server, but not the httpServer itself
        httpTransport.close();
        server.close();
      });

      // Connecting MCP-server to HTTP transport
      await server.connect(httpTransport);

      // Handle POST Requests for this endpoint
      if (req.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const rawBody = Buffer.concat(chunks).toString();
        try {
          body = JSON.parse(rawBody);
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          // Respond with a JSON-RPC Parse error
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
          return;
        }
      }

      await httpTransport.handleRequest(req, res, body);
    });

    // Start HTTP Server on the specified host and port
    httpServer.listen(httpPort, host, () => {
      logger.info(`Dynatrace Managed MCP Server running on HTTP at http://${host}:${httpPort}`);
      console.error(`Dynatrace Managed MCP Server running on HTTP at http://${host}:${httpPort}`);
    });

    // Handle graceful shutdown for http server mode
    process.on(
      'SIGINT',
      shutdownHandler(
        async () => await telemetry.shutdown(),
        () =>
          new Promise<void>((resolve) => {
            httpServer.closeAllConnections?.(); // Force close all connections (Node.js 18.2+)
            httpServer.close(() => resolve());
          }),
      ),
    );
    process.on(
      'SIGTERM',
      shutdownHandler(
        async () => await telemetry.shutdown(),
        () =>
          new Promise<void>((resolve) => {
            httpServer.closeAllConnections?.(); // Force close all connections (Node.js 18.2+)
            httpServer.close(() => resolve());
          }),
      ),
    );
  } else {
    // Default stdio mode
    const transport = new StdioServerTransport();

    logger.info('Connecting server to transport...');
    await server.connect(transport);

    logger.info('Dynatrace Managed MCP Server running on stdio');
    console.error('Dynatrace Managed MCP Server running on stdio');

    // Handle graceful shutdown for stdio mode
    process.on(
      'SIGINT',
      shutdownHandler(async () => await telemetry.shutdown()),
    );
    process.on(
      'SIGTERM',
      shutdownHandler(async () => await telemetry.shutdown()),
    );
  }
};

main().catch(async (error) => {
  logger.error(`Fatal error in main(): ${error.message}`, { error: error });
  try {
    // report error in main
    const telemetry = createTelemetry();
    await telemetry.trackError(error, 'main_error');
    await telemetry.shutdown();
  } catch (e: any) {
    logger.error(`Failed to track fatal error: ${e.message}`, { error: e });
  }
  process.exit(1);
});
