# Local setup (stdio)

Local (stdio) mode is for one person running the server on one machine: your AI client launches the server itself as a child process, and the Dynatrace API token(s) live in a config file on that machine. This is the mode most individual users and contributors want.

For a shared or production-like deployment where the server runs once and many users connect to it, see [Set up remote (HTTP) mode](setup-remote.md) instead.

## How it works

Your AI client starts the server as a child process and talks to it over stdio — there's no network port between client and server, and no separate process to keep alive yourself. This explains most local-mode support tickets, so it's worth understanding precisely:

- **Configuration is checked first, for both modes.** The server parses your config and confirms every entry has the required fields (URL, environment ID, alias, and — in local mode — a token). If any entry is missing a required field, or the config resolves to zero entries, the server logs the problem and exits with code `1` immediately, before contacting any cluster.
- **Local mode then validates connectivity, live, at startup.** For each configured environment that has a token, the server calls the cluster to check connectivity and version. An environment that fails this check is excluded from that session's queryable set — logged by alias — but the server keeps running with whatever environments did pass. An environment with no token configured is skipped from this check entirely (there's no token to call the cluster with), and so it is also never queryable that session.
- **Remote (HTTP) mode skips the live check.** Tokens arrive per request rather than from server-side config, so there is nothing to validate at startup. See [Set up remote (HTTP) mode](setup-remote.md).

The practical effect in local mode: a bad URL, wrong environment ID, revoked token, or missing field surfaces immediately and visibly — either as an exit at launch, or as a clear log line naming the broken environment — rather than as a silent failure the first time your assistant tries to use it.

## Create an API token

Create a Dynatrace Managed API token with the required scopes before you configure anything — see [Create an API token](api-token.md).

## Create the configuration file

Create `~/.dynatrace/managed-mcp.yaml`:

```yaml
- alias: production
  apiEndpointUrl: https://abc123.dynatrace-managed.com:9999
  environmentId: 01234567-89ab-cdef-abcd-ef0123456789
  apiToken: dt0c01.ABC123...
```

Restrict its permissions — `chmod 600 ~/.dynatrace/managed-mcp.yaml` on macOS and Linux.

For more than one environment, add more entries with distinct aliases:

```yaml
- alias: production
  apiEndpointUrl: https://abc123.dynatrace-managed.com:9999
  environmentId: 01234567-89ab-cdef-abcd-ef0123456789
  apiToken: dt0c01.ABC123...

- alias: staging
  apiEndpointUrl: https://staging.dynatrace-managed.com:9999
  environmentId: 76543210-fedc-ba98-dcba-9876543210fe
  apiToken: dt0c01.XYZ789...
```

The alias is how you refer to an environment when talking to your assistant, so pick something your assistant (and you) can say unambiguously.

- Full field reference: [Configuration fields](configuration.md#configuration-fields).
- Using more than one environment day to day: [Multi-environment setup](multi-environment.md).

## Choose how to run the server

All four launch the same server in stdio mode; pick the one that fits your workflow.

**npx, latest (recommended):**

```bash
npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest
```

**npx, pinned to a specific version, for reproducibility:**

```bash
npx -y @dynatrace-oss/dynatrace-managed-mcp-server@1.0.1
```

Pinning avoids a surprise version change mid-sprint — `@latest` picks up whatever was published most recently, which may be after you tested.

**Global install:**

```bash
npm install -g @dynatrace-oss/dynatrace-managed-mcp-server
```

Then run it with the installed binary:

```bash
mcp-server-dynatrace
```

**From a clone, for contributors:**

```bash
npm install && npm run build
```

Then run the built output directly:

```bash
node ./dist/index.js
```

See the [development guide](DEVELOPMENT.md) for the full contributor workflow.

## Verify the server starts

Before wiring the server into any client, confirm it starts cleanly on its own:

```bash
DT_CONFIG_FILE=~/.dynatrace/managed-mcp.yaml \
  npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest
```

On success, you'll see `Dynatrace Managed MCP Server running on stdio` printed to **stderr**. The process then waits for MCP protocol traffic on stdin — that's correct behavior, not a hang. Press `Ctrl+C` to stop it.

On failure, the server prints its configuration errors and exits with code `1`.

This is the fastest way to tell "the server is broken" from "my client config is wrong" — if this command doesn't succeed, no client configuration will fix it. If it does succeed but your client still can't reach the server, see [Troubleshooting](troubleshooting.md).

## Add it to your client

| Client             | Guide                                              |
| ------------------ | -------------------------------------------------- |
| Claude Code        | [Set up Claude Code](clients/claude-code.md)       |
| VS Code + Copilot  | [Set up VS Code](clients/vs-code-copilot.md)       |
| GitHub Copilot CLI | [Set up Copilot CLI](clients/copilot-cli.md)       |
| Claude Desktop     | [Set up Claude Desktop](clients/claude-desktop.md) |

Cursor, Windsurf, Kiro, Gemini CLI and ChatGPT: [other clients](clients/other-clients.md).

## Logs

On stdio, stdout carries the MCP protocol, so never point logging at a stdout variant — it will corrupt the protocol stream. Use one of:

- `LOG_OUTPUT=stderr-all` — surfaces logs in your client's output/log panel.
- `LOG_OUTPUT=file` (the default) — writes to `dynatrace-managed-mcp.log` in the server's working directory; read it with `tail -f dynatrace-managed-mcp.log`.

Full transport matrix and defaults: [Logging](configuration.md#logging).

## Changing the configuration

The server reads its configuration once, at startup. Editing `~/.dynatrace/managed-mcp.yaml` (or any environment variable) has no effect on a running server — restart or reload the MCP server connection in your client before expecting the change to take effect.
