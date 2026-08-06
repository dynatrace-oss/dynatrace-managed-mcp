# Claude Code

## Prerequisites

- A Dynatrace Managed API token — see [Create an API token](../api-token.md).
- `~/.dynatrace/managed-mcp.yaml` — see [Set up local (stdio) mode](../setup-local.md).

## Add the server (local)

```bash
claude mcp add dynatrace-managed --scope project \
  -e DT_CONFIG_FILE=~/.dynatrace/managed-mcp.yaml \
  -- npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest
```

`--scope` controls where the registration is stored:

- `local` (default) — this project only, visible to you alone.
- `project` — committed to `.mcp.json`, shared with your team.
- `user` — all your projects, on this machine.

Use `project` when your team shares one Managed environment and wants everyone registering it the same way; use `user` for personal use across repositories.

The equivalent `.mcp.json`, for hand-editing or committing directly:

```json
{
  "mcpServers": {
    "dynatrace-managed": {
      "command": "npx",
      "args": ["-y", "@dynatrace-oss/dynatrace-managed-mcp-server@latest"],
      "env": {
        "DT_CONFIG_FILE": "~/.dynatrace/managed-mcp.yaml"
      }
    }
  }
}
```

Committing `.mcp.json` is safe: it names the config file rather than containing a token. Keep `~/.dynatrace/managed-mcp.yaml` itself out of the repository.

## Add the server (remote)

```bash
claude mcp add --transport http dynatrace-managed https://mcp.internal.example.com/ \
  --header "X-Dynatrace-Tokens: production=dt0c01.YOUR_TOKEN"
```

The header carries `alias=token` pairs, semicolon-separated for more than one environment — see [How authentication works](../setup-remote.md#how-authentication-works).

## Verify

Run `/mcp` inside Claude Code — `dynatrace-managed` should appear with its tools listed. Then ask:

```text
Ask Dynatrace to list problems
```

`claude mcp list` also confirms the registration from the command line.

## Notes and logs

- Remove the registration with `claude mcp remove dynatrace-managed`.
- Claude Code does not pick up configuration changes on a running server — reconnect the server after editing `~/.dynatrace/managed-mcp.yaml` or the `env` block.
- For server-side diagnostics, add `LOG_OUTPUT=stderr-all` and `LOG_LEVEL=debug` to the `env` block; see [Logging](../configuration.md#logging).
