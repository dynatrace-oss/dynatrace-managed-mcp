# Create an API token

Dynatrace Managed uses API token-based authentication.

## Create the token

Create an API token in your Dynatrace Managed cluster, with the scopes listed under [Required scopes](#required-scopes) below.

For the exact steps in your cluster's UI, see the [Dynatrace Managed documentation](https://docs.dynatrace.com/managed/discover-dynatrace/references/dynatrace-api/basics/dynatrace-api-authentication).

## Required scopes

Your API token must include the following scopes for full functionality — this list is grounded directly in the API paths the server calls (`src/capabilities/*.ts`), not carried over from an older list:

- Access problem and event feed, metrics, and topology (`DataExport`)
- Read entities (`entities.read`)
- Read events (`events.read`)
- Read logs (`logs.read`)
- Read metrics (`metrics.read`)
- Read problems (`problems.read`)
- Read security problems (`securityProblems.read`)
- Read SLO (`slo.read`)

Two scopes that appeared on earlier versions of this list, `auditLogs.read` and `networkZones.read`, are **not required**: no code path in this server calls an audit-log or network-zone endpoint. Don't grant them — a security-sensitive token should carry no more access than it needs.

**HTTP mode also needs a token that validates.** Every HTTP-mode request checks the caller's supplied token by calling `POST /api/v2/apiTokens/lookup` (`validateAPIToken`). Per Dynatrace's own API documentation, that endpoint accepts a token carrying **any** scope — it isn't gated on a specific one — so any token built from the list above already satisfies it; no additional scope is needed. This check does not run in local (stdio) mode.

API token scopes in Managed deployments differ from SaaS Platform tokens. Ensure you select the correct scopes for your Managed cluster version.

> [!NOTE]
> The server's own `dynatrace_managed_get_environments_info` tool currently reports a different, legacy set of scope names (`ReadProblems`, `ReadSLO`, and similar) — this is a known code-side inconsistency, not a second valid list. This page is authoritative; if the tool and this page disagree, trust this page.

## Where the token goes

**Local (stdio):** the token lives in your config file, server-side. See [Set up local mode](setup-local.md).

**Remote (HTTP):** the server holds no tokens — each user sends their own in the `X-Dynatrace-Tokens` header. See [Set up remote mode](setup-remote.md).

The scopes above apply identically in both modes.

## Minimum cluster version

Dynatrace Managed `1.328.0` or later is required.

**Local (stdio):** at startup, the server checks each configured environment's cluster version. An environment below the minimum version is logged by name and then excluded from that session's queryable environments — tool calls against its alias fail with "Environment alias(es) not valid" until the cluster is upgraded. This does not stop the server itself; other environments that pass the check remain usable.

**Remote (HTTP):** there is no automatic startup check. Call the `dynatrace_managed_get_environments_info` tool to check a cluster's version on demand; a below-minimum cluster is reported with a warning but is not blocked from use.

In both modes, if the token lacks permission for `/api/v1/config/clusterversion`, the server assumes the minimum version and continues.

## Token problems

Token rejected, missing scopes, or connection failures? See [Troubleshooting](troubleshooting.md).
