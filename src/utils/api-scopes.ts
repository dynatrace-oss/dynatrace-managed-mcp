/**
 * API token scopes required by this server.
 *
 * This server calls endpoints from both API versions, and each version's scope model is
 * different:
 *
 * - One v1 endpoint, `GET /api/v1/config/clusterversion` (`managed-auth-client.ts`'s
 *   `validateConnection`/`getClusterVersion`, outside `src/capabilities/`), requires the legacy
 *   `DataExport` scope. This is not a leftover to prune: issue #68 is exactly a token missing
 *   `DataExport` failing environment validation with a 403 on this call, because an earlier
 *   version of the documentation omitted it. Keep `DataExport` in this list.
 * - Every other endpoint the server calls - all in `src/capabilities/*.ts` - is a v2 API, and
 *   each requires its own v2 dotted scope (`entities.read`, `events.read`, etc.), not `DataExport`.
 * - `POST /api/v2/apiTokens/lookup` (`validateAPIToken`, used to validate a caller-supplied token
 *   in HTTP mode) needs no specific scope - per Dynatrace's API documentation, it accepts a token
 *   carrying any scope. Don't add `apiTokens.read` or similar; it doesn't exist and isn't needed.
 *
 * This is the single source of truth for the list - both the startup/connection-failure logging
 * in `managed-auth-client.ts` and the `dynatrace_managed_get_environments_info` tool response in
 * `environment-tools.ts` import it from here, so they cannot drift apart again. Keep it aligned
 * with the user-facing writeup in `docs/api-token.md`.
 */
export const MANAGED_API_SCOPES = [
  'DataExport', // Required by the v1 GET /api/v1/config/clusterversion call - see #68
  'entities.read', // Read entities
  'events.read', // Read events
  'logs.read', // Read logs
  'metrics.read', // Read metrics
  'problems.read', // Read problems
  'securityProblems.read', // Read security problems
  'slo.read', // Read SLO
];
