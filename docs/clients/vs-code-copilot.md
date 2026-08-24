# VS Code + GitHub Copilot

In VS Code, GitHub Copilot **is** the MCP client — there is no separate MCP extension to install. Servers are declared in `.vscode/mcp.json`, and Copilot Chat, running in agent mode, is what actually calls them.

## Prerequisites

- A Dynatrace Managed API token — see [Create an API token](../api-token.md).
- `~/.dynatrace/managed-mcp.yaml` — see [Set up local (stdio) mode](../setup-local.md).
- GitHub Copilot Chat, with agent mode enabled. In workspace settings (`.vscode/settings.json`):

  ```json
  {
    "github.copilot.enable": {
      "*": true
    }
  }
  ```

  See [what enabling agent mode looks like](../../assets/copilot-enable-agent-mode.gif) in the UI.

## Add the server (local)

Create or edit `.vscode/mcp.json`. The top-level key is **`servers`**, not `mcpServers` — this is the one detail that differs from every other client in this guide, and getting it wrong fails silently (Copilot simply never sees the server, with no error pointing at the key name):

```json
{
  "servers": {
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

`cwd: "${workspaceFolder}"` and `envFile: "${workspaceFolder}/.env"` are also available, but only work when this file lives in the workspace itself (`<your-repo>/.vscode/mcp.json`) — see [the predefined-variables reference](https://code.visualstudio.com/docs/reference/variables-reference#_predefined-variables). They have no meaning in user settings, since there is no workspace to resolve `${workspaceFolder}` against. For a user-level setup, use `env` with `DT_CONFIG_FILE` as shown above: the server expands the leading `~` itself, so no workspace variable is needed.

## Add the server (remote)

```json
{
  "servers": {
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

Start the server using the gutter action next to its entry in `mcp.json` (or restart it from the command palette), then open Copilot Chat in agent mode and check the tools picker lists the Dynatrace tools. Then ask:

```text
Ask Dynatrace to list problems
```

## Notes and logs

- Set `LOG_OUTPUT=stderr-all` in the `env` block so logs appear in VS Code's Output panel instead of a log file — see [Logging](../configuration.md#logging).
- Reload the server after editing `~/.dynatrace/managed-mcp.yaml` or the `env` block; running servers do not pick up configuration changes.
- Prefer committing `.vscode/mcp.json` to the workspace over configuring it in user settings, so your team registers the server the same way.
- Registered but Copilot still can't reach the server? See [Troubleshooting](../troubleshooting.md).
