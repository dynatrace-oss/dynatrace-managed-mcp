# GitHub Copilot CLI

Configuration lives in `~/.copilot/mcp-config.json`, under a top-level `mcpServers` key. Verify the current shape against [GitHub's own docs](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers) before relying on it here — this is a third-party tool and its config format can change.

## Prerequisites

- A Dynatrace Managed API token — see [Create an API token](../api-token.md).
- `~/.dynatrace/managed-mcp.yaml` — see [Set up local (stdio) mode](../setup-local.md).

## Add the server (local)

Edit `~/.copilot/mcp-config.json`:

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

`type` also accepts `"local"`, but use `"stdio"` as shown: it is the standard MCP protocol type name, so the same server block stays compatible with VS Code, the Copilot coding agent, and other MCP clients, instead of a value specific to Copilot CLI.

You can also add a server interactively from inside a `copilot` session with `/mcp add`, and manage existing ones with `/mcp show`, `/mcp show SERVER-NAME`, `/mcp edit SERVER-NAME`, `/mcp delete SERVER-NAME`, `/mcp disable SERVER-NAME`, and `/mcp enable SERVER-NAME` (`/mcp search` is experimental).

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

Run `/mcp show dynatrace-managed` inside a `copilot` session to confirm the registration and see its tools. Then ask:

```text
Ask Dynatrace to list problems
```

## Notes and logs

- Copilot CLI's model API rejects tool schemas that contain `$schema` or `additionalProperties: false`, so this server strips both from `tools/list` responses (`src/utils/mcp-compat.ts`). Versions before this workaround shipped failed against Copilot CLI with a `400 Bad Request` — run `@latest`, or at least `0.5.7`.
- In HTTP mode the server sets `enableJsonResponse`, returning a plain JSON response instead of keeping an SSE stream open, so clients that cannot hold a persistent SSE connection still work (`src/index.ts`).
- Registered but Copilot CLI still can't reach the server? See [Troubleshooting](../troubleshooting.md).
