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
      "type": "stdio",
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

`claude_desktop_config.json` is a **local/stdio mechanism only**. Anthropic says so explicitly: "Local MCP servers configured in Claude Desktop via `claude_desktop_config.json` are a separate mechanism and do use your local network, but those aren't available in Cowork or claude.ai" ([Custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)). There is no `"type": "http"` entry in this file that Claude Desktop actually honors — an earlier version of this page showed one, and it was wrong.

### Recommended: the `mcp-remote` stdio bridge

The config file stays a **local/stdio** entry. Its `command` launches [`mcp-remote`](https://github.com/geelen/mcp-remote), a third-party stdio-to-HTTP bridge, which then speaks to your deployed server over the network you already control — no traffic ever leaves it for a third party's cloud:

```json
{
  "mcpServers": {
    "dynatrace-managed": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.internal.example.com/", "--header", "X-Dynatrace-Tokens:${DT_TOKENS}"],
      "env": {
        "DT_TOKENS": "production=dt0c01.YOUR_TOKEN"
      }
    }
  }
}
```

Pass the token through `env` and reference it from `--header` with `${DT_TOKENS}` rather than inlining it in `args`, as shown: Claude Desktop on Windows has a documented bug that mangles spaces inside `args`, which corrupts a header value passed directly on the command line. `mcp-remote` describes itself as experimental — confirm it against your own deployment before relying on it.

### Settings → Connectors (generally unsuitable for a self-hosted deployment)

Claude Desktop also has a **Settings → Connectors** UI for adding a remote MCP server with no bridge process, documented at [Custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp). Two things make it a poor fit for this server specifically:

- **Traffic originates from Anthropic's cloud, not your machine.** Anthropic's own wording: "Claude connects to your remote MCP server from Anthropic's cloud infrastructure, rather than from your local device." An internal-only host like `mcp.internal.example.com` is unreachable this way unless you expose it to the public internet or allowlist Anthropic's IP ranges at your perimeter.
- **Custom request headers are not documented as supported.** The Connectors setup takes only a URL and, optionally, OAuth client credentials — nothing for `X-Dynatrace-Tokens`, which this server's remote mode requires for every request. **Unverified:** whether the UI has an undocumented way to set one; nothing in Anthropic's published documentation confirms or rules it out.

Prefer the `mcp-remote` bridge above unless your deployment is genuinely internet-reachable and you've independently confirmed a way to supply the token header.

## Verify

After editing the config file, **fully quit and reopen Claude Desktop** — closing the window is not enough, since the app keeps running and won't reread the file until it's relaunched. Once it's back, look for the tools/MCP indicator near the message box and confirm `dynatrace-managed` is listed. Then ask:

```text
Ask Dynatrace to list problems
```

## Notes and logs

- Any change to the config file requires the same full quit and reopen described above — Claude Desktop does not pick up edits on a running server.
- Server logs go to the log file by default; see [Logging](../configuration.md#logging) for how to redirect them.
- Registered but Claude Desktop still can't reach the server? See [Troubleshooting](../troubleshooting.md).
