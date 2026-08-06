# Troubleshooting

Before touching your AI client's configuration, run the server standalone, outside any client, and read what it prints. That single step tells you whether the problem is the server's own configuration or the client wiring around it — see [Verify the server starts](setup-local.md#verify-the-server-starts) for the full explanation.

## Start here

```bash
DT_CONFIG_FILE=~/.dynatrace/managed-mcp.yaml LOG_OUTPUT=stderr-all \
  npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest
```

Watch stderr for one of three outcomes:

1. `Dynatrace Managed MCP Server running on stdio`, with no warning above it. Your configuration and token are fine — the problem is in your client's configuration, not the server. Press `Ctrl+C` and recheck how you registered the server with your client.
2. The process exits with code `1` and prints an error above the exit. The error text names the cause — find it below.
3. The success line prints, but with a warning above it naming one environment. That environment looked fine structurally but failed to connect, and was silently dropped — see [The success line prints, but tool calls fail anyway](#the-success-line-prints-but-tool-calls-fail-anyway) below. This is the case most likely to mislead you, because the terminal still looks like success.

## Common problems

### `EBADENGINE` during install

Your Node.js version is outside `>=26.5.1 <27`. Install a supported version and reinstall.

### `Failed to get managed environments configurations:`

Which message you see for a bad or missing field depends on how you supply configuration:

**Using `DT_CONFIG_FILE`** — the method the rest of this documentation set teaches — a missing or empty required field is caught earlier than this message, while the file is still being loaded, and reported as:

```text
Environment #1 in ~/.dynatrace/managed-mcp.yaml is missing required fields: apiToken
Found fields: apiEndpointUrl, environmentId, alias
```

(or `Environment #N in <path> must be an object.` if an entry isn't a mapping at all). The required fields are `apiEndpointUrl`, `environmentId`, `alias`, and — in local/stdio mode only — `apiToken`; HTTP mode doesn't require `apiToken`. This is why a config-file user will rarely see the `Failed to get managed environments configurations:` / `error`-array form below. This early check is logged, not printed directly to the console, so it needs `LOG_OUTPUT=stderr-all` (as in [Start here](#start-here)) to be visible on a terminal — the default `LOG_OUTPUT=file` writes it only to the log file.

**Using `DT_ENVIRONMENT_CONFIGS`** — this path has no early field check of its own, so the same kind of problem instead reaches the later, per-entry validation and prints `Failed to get managed environments configurations:` together with an `error` array naming the exact field, entry index and alias. The process exits as soon as **any** entry fails this check, even if your other environments are perfectly valid — one bad entry stops the whole server. An alias containing a semicolon (`;`) is also rejected only at this later stage, regardless of which method you used to supply configuration.

Either way, cross-check the field names against [Configuration fields](configuration.md#configuration-fields).

A config file that can't be loaded at all fails differently again: `Configuration file not found:`, `Failed to parse <format> file:`, or, if a `${VAR}` interpolation references an unset variable, `Environment variable not found:`. Check the path passed to `DT_CONFIG_FILE`: relative paths resolve against your **client's** working directory, not your project or home directory, so prefer `~` or an absolute path. See [Configuration file](configuration.md#configuration-file).

### Exits with `No valid environments found, stopping.`

This is **structural** configuration validation, and it fires only when the parsed configuration contains zero environment entries at all — an empty list in the config file, or `DT_ENVIRONMENT_CONFIGS` set to `[]`. (A config with one or more entries that fail validation exits with the `Failed to get managed environments configurations:` message above instead, before this check is ever reached.) This runs before the server ever picks a mode, so it happens identically in local and remote setups, and nothing has contacted your cluster yet. It is **not** a connectivity or token-scope problem — don't spend time re-checking your token or network for this one. Check the array in your [configuration file](configuration.md#configuration-file) — it needs at least one entry.

### The success line prints, but tool calls fail anyway

> [!IMPORTANT]
> This is the most confusing failure this server can produce, because the terminal shows nothing wrong.

In local (stdio) mode, the server prints `Dynatrace Managed MCP Server running on stdio` even when the live-cluster check failed for **every** configured environment. Nothing in the code checks whether any environment actually survived that check before printing the success line — so a totally broken deployment looks, from the terminal alone, identical to a working one.

With the default `LOG_OUTPUT=file`, the per-environment diagnostic that would explain this — logged via `logger.error` for a connection failure, or `logger.info` for a below-minimum cluster version — goes only to the log file, not your terminal, so you see nothing at all. The symptom shows up later, when the assistant tries to use a tool and gets back:

```text
Environment alias(es) not valid. Options are: ALL_ENVIRONMENTS
```

If every alias you configured is missing from that list — leaving only the placeholder `ALL_ENVIRONMENTS` — every environment failed its live-cluster check at startup.

**Fix:** re-run the standalone command from [Start here](#start-here) with `LOG_OUTPUT=stderr-all` and read the warning printed for each alias. The cause is one of: a bad or revoked token, a wrong `apiEndpointUrl` or `environmentId`, an unreachable cluster, or a cluster version below the minimum — see [Minimum cluster version](api-token.md#minimum-cluster-version). This matches the third outcome in [Verify the server starts](setup-local.md#verify-the-server-starts).

### `Unauthorized: no valid Dynatrace token supplied` (HTTP 401)

The JSON-RPC error message is exactly `Unauthorized: no valid Dynatrace token supplied`; the `401` is the separate HTTP status code the response also carries — search on either. In remote (HTTP) mode this has two indistinguishable causes, and one is easy to overlook:

- The alias on the left of `=` in your `X-Dynatrace-Tokens` header doesn't exactly match an `alias` in the server's configuration. When no alias matches, the server never gets far enough to check the token at all — it returns this same `401` even for a perfectly valid token. Check your aliases first; it's the cheaper thing to rule out.
- The token itself is missing, malformed, or invalid for every environment it was supplied against.

See [How authentication works](setup-remote.md#how-authentication-works) for the header format and exactly why a mismatched alias produces this response. Token validity is cached for 60 seconds by default, so after fixing a token, either wait or lower `DT_MCP_TOKEN_VALIDATION_TTL_MS`.

### `Rate limit exceeded: Maximum N tool calls per M seconds`

You've hit the per-caller tool-call limit. In HTTP mode this is scoped per caller (by token), not per server, so other users are unaffected. Raise `DT_MCP_RATE_LIMIT_MAX_CALLS` / `DT_MCP_RATE_LIMIT_WINDOW_MS`, or narrow the question so the assistant needs fewer tool calls — see [Rate limiting](configuration.md#rate-limiting).

### `Request Entity Too Large`

HTTP mode only, returned with status `413`: the request body exceeded `DT_MCP_MAX_BODY_SIZE` (1 MB / `1048576` bytes by default). Raise the limit if your client legitimately sends larger payloads — see [Environment variables](configuration.md#environment-variables).

### Client reports "connection closed" during initialization

Your AI client — not this server — reports that the MCP connection closed before it finished initializing, usually because the server process failed to start or died immediately after. The exact wording and error code vary by client, since each bundles its own MCP SDK version, so there's no single string to search for here. The diagnostic step is the same regardless: run the server standalone — see [Start here](#start-here) — and read the actual error there instead of guessing from the client's generic message.

### `Transport closed` on a tool call

In stdio mode, stdout is reserved exclusively for the MCP protocol; anything else written there — a stray `console.log`, a library that logs to stdout — corrupts the stream and the client sees the transport as closed. Make sure `LOG_OUTPUT` is not set to a stdout variant (`stdout`, `console`, `file+console`, `file+stdout`); use `stderr-all` or `file` instead. See [Logging](configuration.md#logging).

### Remote server unreachable from another machine

The server still bound to its default host, `127.0.0.1`, which only accepts connections from the same machine. Start it with `--host 0.0.0.0` (or a specific interface address) — see [Remote setup (HTTP)](setup-remote.md).

### Requests fail once many environments are configured

Each caller's `X-Dynatrace-Tokens` header grows with the number of environments they hold tokens for, and can exceed a header size limit — Node's own default, or a reverse proxy's smaller one in front of it. See [Limits and tuning](setup-remote.md#limits-and-tuning) for the exact thresholds and how to raise them.

### A configured proxy appears to be ignored

The standard `HTTP_PROXY` / `HTTPS_PROXY` environment variables are **not** read by this server, no matter how they're set. Proxies are configured per environment instead, with the `httpProxyUrl` / `httpsProxyUrl` config fields — see [Proxy](configuration.md#proxy). Setting both fields on the same environment disables the proxy for it entirely, so also check you set only one.

### The assistant answers about the wrong environment

Add steering rules so the assistant asks (or infers correctly) which environment you mean — see [Multiple environments](multi-environment.md). If you're also running the Dynatrace SaaS MCP server alongside this one, see [Running alongside the Dynatrace SaaS MCP](hybrid-saas-managed.md) for steering that keeps the two servers apart.

### Config changes have no effect

Configuration is read once, at startup. Editing the config file or an environment variable has no effect on a server that's already running — restart the process, or reconnect the MCP server in your client, before expecting the change to take effect.

## Getting more detail

Set `LOG_LEVEL=debug` together with `LOG_OUTPUT=stderr-all` to see everything in your client's output/log panel, or leave `LOG_OUTPUT` at its `file` default and `tail -f dynatrace-managed-mcp.log`. Ask the assistant to report the exact error the MCP tool call returned — it's usually more specific than what the client surfaces on its own. For problems that happen before the client ever connects, also check the client's own MCP logs, not just this server's. Full transport matrix and defaults: [Logging](configuration.md#logging).

## Still stuck

Open a GitHub issue with:

- The server version (`npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest --version`).
- Your AI client and its version.
- The mode you're running (local/stdio or remote/HTTP).
- A debug log (`LOG_LEVEL=debug`, `LOG_OUTPUT=stderr-all` or `file`) covering the failure, with tokens and any other secrets redacted.
