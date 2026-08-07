/**
 * API token scopes required by this server.
 *
 * Every endpoint the server calls (see `src/capabilities/*.ts`) is a v2 API, so these are the
 * v2 dotted scope names, with the exception of `DataExport`, which is the scope the v2 problem
 * and event feed, metrics, and topology endpoints still require.
 *
 * This is the single source of truth for the list - both the startup/connection-failure logging
 * in `managed-auth-client.ts` and the `dynatrace_managed_get_environments_info` tool response in
 * `environment-tools.ts` import it from here, so they cannot drift apart again. Keep it aligned
 * with the user-facing writeup in `docs/api-token.md`.
 */
export const MANAGED_API_SCOPES = [
  'DataExport', // Access problem and event feed, metrics, and topology
  'entities.read', // Read entities
  'events.read', // Read events
  'logs.read', // Read logs
  'metrics.read', // Read metrics
  'problems.read', // Read problems
  'securityProblems.read', // Read security problems
  'slo.read', // Read SLO
];
