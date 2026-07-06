import { ZodRawShape } from 'zod';
import { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { ManagedAuthClientManager } from '../authentication/managed-auth-client';
import { MetricsApiClient } from '../capabilities/metrics-api';
import { LogsApiClient } from '../capabilities/logs-api';
import { EventsApiClient } from '../capabilities/events-api';
import { EntitiesApiClient } from '../capabilities/entities-api';
import { ProblemsApiClient } from '../capabilities/problems-api';
import { SecurityApiClient } from '../capabilities/security-api';
import { SloApiClient } from '../capabilities/slo-api';

/**
 * Registers a single tool. Mirrors the `tool` wrapper defined in index.ts, which adds
 * consistent error handling, telemetry, and rate limiting around the callback.
 */
export type ToolRegistrar = <TArgs = undefined>(
  name: string,
  description: string,
  paramsSchema: ZodRawShape,
  annotations: ToolAnnotations,
  cb: (args: TArgs) => Promise<string>,
) => void;

/**
 * Per-request dependencies shared by all tool registration functions. Built once per
 * McpServer instance (per request in stateless HTTP mode) and passed to each register*Tools().
 */
export interface ToolContext {
  tool: ToolRegistrar;
  authClientManager: ManagedAuthClientManager;
  metricsClient: MetricsApiClient;
  logsClient: LogsApiClient;
  eventsClient: EventsApiClient;
  entitiesClient: EntitiesApiClient;
  problemsClient: ProblemsApiClient;
  securityClient: SecurityApiClient;
  sloClient: SloApiClient;
  envAliasValidate: (alias: string) => boolean;
  initErrors: string[];
  httpMode: boolean;
}
