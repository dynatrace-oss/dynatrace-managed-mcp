# Overview

## Use cases

There are two ways that Dynatrace Managed, and thus the MCP, may be used:

1. Your Dynatrace Managed environment(s) is/are the primary Observability system, containing all live data; or
2. There has been a migration from a Dynatrace Managed environment to a Dynatrace SaaS environment; however, historical observability data has not been migrated and can still be accessed via a Dynatrace Managed environment.
   The Dynatrace Managed MCP is used to access historical data, and a separate Dynatrace SaaS MCP is used to access live and more recent data — see [Hybrid SaaS + Managed setup](hybrid-saas-managed.md) for running both together.

Specific use cases for the Dynatrace Managed MCP include:

- **Real-time observability** - Fetch production-level data for early detection and proactive monitoring
- **Contextual debugging** - Fix issues with full context from monitored exceptions, logs, and anomalies
- **Security insights** - Get detailed vulnerability analysis and security problem tracking. This can include multicloud compliance assessment with evidence-based investigation.
- **Natural language queries** - Queries are mapped to MCP tool usage, and thus API queries, with guidance for the next step
- **Multiphase incident investigation** - Systematic impact assessment and troubleshooting
- **Multienvironment support** - Query multiple Dynatrace Managed environments from the same MCP server

## Capabilities

The [README](../README.md#capabilities) lists these seven capabilities as a one-line-each summary; this section is the detailed version — what each one actually lets you ask, and the API domain it's built on.

- **Problems** — List open or historical [problems](https://www.dynatrace.com/hub/detail/problems/) and fetch full details for one, including affected entities and root-cause information, for services and infrastructure across your monitored environments (for example Kubernetes workloads). Built on the Problems v2 API.
- **Security** — List and get [security problems](https://www.dynatrace.com/hub/detail/vulnerabilities/) — vulnerabilities detected in your runtime — with severity, affected entities, and remediation context. Built on the Security Problems v2 API.
- **Entities** — Look up a monitored entity (a host, service, process group, and so on) and its relationship mappings to other entities, so an assistant can walk from a symptom (a problem or a log line) to the topology around it. Built on the Entities v2 API.
- **SLO** — List Service Level Objectives and get evaluation details for one, including its current error budget, so an assistant can answer "are we within budget" without a dashboard round-trip. Built on the SLO v2 API.
- **Event Tracking** — List and get system events (deployments, configuration changes, and similar), useful for correlating a problem's onset with something that changed around the same time. Built on the Events v2 API.
- **Log Investigation** — Search and filter logs with content-based queries (matching text or fields) and time-based windows, for pulling the log lines relevant to an incident without leaving the assistant. Built on the Logs v2 API.
- **Metrics Analysis** — Query and analyze performance metrics (response time, error rate, throughput, and more), including time-series aggregation, for answering "what did this look like over the last hour" directly. Built on the Metrics v2 API.

These capabilities are all implemented on top of Dynatrace Managed's V2 REST APIs. Per standard Dynatrace Managed licensing, calls to these APIs incur no additional cost beyond your existing Managed license.

## Architecture

### Local mode

![Architecture (local mode)](../assets/dynatrace-managed-mcp-arch-local.png)

See [Set up local (stdio) mode](setup-local.md) to configure and run the server this way.

### Remote mode

![Architecture (remote mode)](../assets/dynatrace-managed-mcp-arch-remote.png)

See [Set up remote (HTTP) mode](setup-remote.md) to configure and run the server this way.

## Performance considerations

**Important:** This MCP server makes API calls to the Dynatrace Managed environment(s). It is designed for efficient usage (e.g., limiting the response sizes), but care should be taken not to overload the Dynatrace Managed environment(s) with large queries.

**Best Practices:**

1. Use specific time ranges (e.g., 1-2 hours) rather than large historical queries.
2. Use specific filters to limit the scope of queries as much as possible, for example, entity selectors that specify the entity ID.
3. If using multiple environments, be specific about which one to query, where applicable. If querying multiple at once, be mindful of how much data will be returned to the LLM, e.g. top 10 problems from 2 envs = 20 problems, versus top 10 problems from 10 envs = 100 problems.

## How this differs from the SaaS MCP

This MCP is for Dynatrace Managed platforms. There is a different [Dynatrace MCP](https://github.com/dynatrace-oss/dynatrace-mcp) server for use with Dynatrace SaaS.

Key differences include:

- Dynatrace SaaS MCP uses DQL, whereas Dynatrace Managed uses the v2 APIs
- Dynatrace SaaS MCP uses Davis CoPilot, whereas Dynatrace Managed does not
- Dynatrace SaaS MCP uses OAuth, whereas Dynatrace Managed uses API Tokens

Running both servers together, including in the historical-data migration scenario above: [Hybrid SaaS + Managed setup](hybrid-saas-managed.md).
