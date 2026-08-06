# Claude Desktop

## Prerequisites

- A Dynatrace Managed API token — see [Create an API token](../api-token.md).
- `~/.dynatrace/managed-mcp.yaml` — see [Set up local (stdio) mode](../setup-local.md).

## Add the server (local)

Edit the config file for your OS:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

The top-level key is `mcpServers`:

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

Use the literal `~/.dynatrace/managed-mcp.yaml` string as shown — no shell is involved in reading this file, and the server expands the leading `~` itself, so writing your own absolute home directory here would only make the file less portable.

## Add the server (remote)

```json
{
  "mcpServers": {
    "dynatrace-managed": {
      "type": "http",
      "url": "https://mcp.internal.example.com/",
      "headers": {
        "X-Dynatrace-Tokens": "production=dt0c01.YOUR_TOKEN"
      }
    }
  }
}
```

The header carries `alias=token` pairs, semicolon-separated for more than one environment — see [How authentication works](../setup-remote.md#how-authentication-works).

## Verify

After editing the config file, **fully quit and reopen Claude Desktop** — closing the window is not enough, since the app keeps running and won't reread the file until it's relaunched. Once it's back, look for the tools/MCP indicator near the message box and confirm `dynatrace-managed` is listed. Then ask:

```text
Ask Dynatrace to list problems
```

## Notes and logs

- Any change to the config file requires the same full quit and reopen described above — Claude Desktop does not pick up edits on a running server.
- Server logs go to the log file by default; see [Logging](../configuration.md#logging) for how to redirect them.
- Registered but Claude Desktop still can't reach the server? See [Troubleshooting](../troubleshooting.md).
