/**
 * Builds the MCP server instructions block sent to connecting clients.
 *
 * @param minimumVersion Minimum supported Dynatrace Managed cluster version, interpolated into the text.
 */
export function buildServerInstructions(minimumVersion: string): string {
  return `
This MCP server connects to Dynatrace Managed (self-hosted) environments for Observabilitiy. This can include metrics, logs and traces,
and detection of problems and security vulnerabilities relating to these.

Some users may configure two MCPs at the same time: this MCP to connect to their Dynatrace Managed instances, and a second MCP to connect to their SaaS environment.
Be careful of which MCP to use. If it is unclear, ask the user which they want to use. Ask the user to confirm the difference between their two environments.

**Key Context:**
- This MCP server accesses self-hosted Dynatrace Managed clusters (not the SaaS version of Dynatrace)
- This MCP server can be used to interact with multiple Dynatrace Managed environments
- Minimum supported cluster version: ${minimumVersion}
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
- Must start by calling the tool get_environments_info. It will return a list of the available environments, including
  details of connection errors and configuration errors.
   - **CRITICAL: must report issues with environment configurations and connections to the user before any other requests**.
- On every subsequent request, an "environment_alias" must be passed.
   - If the user wants information of all available environments, "environment_alias" MUST be "ALL_ENVIRONMENTS"
- Use specific time ranges (1-2 hours) rather than large historical queries for better performance
- Leverage entity selectors to filter data at the source - they are fundamental to getting good results
- Use problem IDs (UUID format) from list_problems, not display IDs (P-XXXXX)
- **When users specify counts** (e.g., "first 25 errors", "50 metrics", "100 errors"), always use the "limit" parameter in tools rather than guessing with searchText
- **Avoid searchText guessing** - only use searchText when user explicitly mentions keywords to search for
- **discover_entities ALWAYS requires entitySelector** - never call this tool without providing an entitySelector with exactly ONE entity type like type("SERVICE") unless using an EntityId. Multiple entity types are NOT supported.
- **Next Steps are important** All requests will come back with a footer called 'Next Steps'. Take into consideration what it says.

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
`;
}
