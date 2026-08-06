# Other clients

These clients all speak MCP the same way — the JSON you register a server with is the same shape used throughout this guide; only the config file's location (and, for ChatGPT, the connection model itself) differs.

## Cursor

Configuration lives in `.cursor/mcp.json` for a single project, or `~/.cursor/mcp.json` to make the server available in every project. Top-level key is `mcpServers`. See [Cursor's MCP docs](https://cursor.com/docs/mcp).

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

For a remote (HTTP) server, Cursor accepts `url` and `headers` in place of `command`/`args`/`env` — the same shape as [`examples/mcp-config-http.json`](../../examples/mcp-config-http.json).

## Windsurf

Configuration lives in `~/.codeium/windsurf/mcp_config.json`, top-level key `mcpServers`. See [Windsurf's MCP docs](https://docs.windsurf.com/windsurf/cascade/mcp).

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

## Kiro

[Amazon Kiro](https://kiro.dev/) is an agentic IDE, and [Kiro CLI](https://kiro.dev/docs/cli/mcp/) provides an interactive chat experience directly in your terminal. Configuration lives in `<project-root>/.kiro/settings/mcp.json`, or in user-level settings (`~/.kiro/settings/mcp.json`). Top-level key `mcpServers`.

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

## Gemini CLI

Configuration lives in `~/.gemini/settings.json` (all projects) or `.gemini/settings.json` (one project), top-level key `mcpServers`:

```json
{
  "mcpServers": {
    "dynatrace-managed": {
      "command": "npx",
      "args": ["-y", "@dynatrace-oss/dynatrace-managed-mcp-server@latest"],
      "env": {
        "DT_CONFIG_FILE": "~/.dynatrace/managed-mcp.yaml"
      },
      "timeout": 30000,
      "trust": false
    }
  }
}
```

Verify the registration with:

```bash
gemini mcp list
```

This repository does not ship a `gemini-extension.json`, so Gemini CLI's extension-install command cannot be used to add this server — edit `settings.json` directly, as shown above.

## ChatGPT

ChatGPT does not launch a local process for MCP servers at all — it connects only to a **remote server, identified by a URL**, added as a custom connector. There is no stdio/local path here; you need a deployed HTTP server first — see [Set up remote (HTTP) mode](../setup-remote.md).

1. Enable developer mode: **Settings → Security and login → Developer mode**. At the workspace level, an admin enables it under **Workspace Settings → Permissions & Roles → Connected Data**. Some of these paths are gated to Enterprise/Edu plans.
2. Add a connector by entering your server's URL, **including the `/mcp` path** (for example `https://mcp.internal.example.com/mcp`), then review the tools ChatGPT discovers before using it.

See [OpenAI's documentation](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) for the current, authoritative steps — this is a third-party product and the flow above can change.

OpenAI's own docs warn that connecting an MCP server increases exposure to prompt injection; that's worth taking seriously here, since a connected server can return real data from your Dynatrace Managed environment.

**Unverified: whether ChatGPT's connector UI lets you supply a custom request header.** This server's remote mode authenticates every request via an `X-Dynatrace-Tokens` header (see [How authentication works](../setup-remote.md#how-authentication-works)). Nothing in OpenAI's published documentation confirms or rules out custom headers on a connector, so whether ChatGPT can authenticate to this server at all is untested and not established here. Rather than invent a configuration that might not work, this page stops at what's known: point ChatGPT at OpenAI's own documentation above, and treat this combination as untested until you've confirmed header support yourself.

## Anything else

Any MCP-capable client works with this server: use the shape shown above, pointed at your client's own config file location. Missing a client you'd like documented here? [Open an issue](https://github.com/dynatrace-oss/dynatrace-managed-mcp/issues).
