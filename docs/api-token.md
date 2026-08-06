# Create an API token

Dynatrace Managed uses API token-based authentication.

## Create the token

1. In your Dynatrace Managed cluster, go to **Settings > Integration > Dynatrace API**.
2. Click **Generate token**.
3. Give the token a name you'll recognize later, for example `managed-mcp`.
4. Select the scopes listed under [Required scopes](#required-scopes) below.
5. Click **Generate token** and copy the value immediately — Dynatrace shows it only once.

For more information about creating API tokens in Managed deployments, see the [Dynatrace Managed documentation](https://docs.dynatrace.com/managed/discover-dynatrace/references/dynatrace-api/basics/dynatrace-api-authentication).

## Required scopes

Your API token must include the following scopes for full functionality:

- Access problem and event feed, metrics, and topology (`DataExport`)
- Read audit logs (`auditLogs.read`)
- Read entities (`entities.read`)
- Read events (`events.read`)
- Read logs (`logs.read`)
- Read metrics (`metrics.read`)
- Read network zones (`networkZones.read`)
- Read problems (`problems.read`)
- Read security problems (`securityProblems.read`)
- Read SLO (`slo.read`)

API token scopes in Managed deployments differ from SaaS Platform tokens. Ensure you select the correct scopes for your Managed cluster version.

## Where the token goes

**Local (stdio):** the token lives in your config file, server-side. See [Set up local mode](setup-local.md).

**Remote (HTTP):** the server holds no tokens — each user sends their own in the `X-Dynatrace-Tokens` header. See [Set up remote mode](setup-remote.md).

The scopes above apply identically in both modes.

## Minimum cluster version

Dynatrace Managed `1.328.0` or later is required.

On older clusters, the server logs a message naming the affected environment and continues rather than stopping.

If the token lacks permission for `/api/v1/config/clusterversion`, the server assumes the minimum version and continues.

## Token problems

Token rejected, missing scopes, or connection failures? See [Troubleshooting](troubleshooting.md).
