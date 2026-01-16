# MCP Registry Onboarding Status

## Status: ✅ COMPLETE

The Dynatrace Managed MCP server is **already fully onboarded** to the MCP registry at https://github.com/mcp/.

**Latest Update:** Enhanced the server description in `server.json` to better distinguish this Managed (self-hosted) version from the SaaS version, making it clearer for users browsing the MCP registry and https://github.com/mcp/.

## Evidence of Successful Onboarding

### 1. Release v0.4.0 Published Successfully

**Date:** January 15, 2026  
**Workflow Run:** #21040076153  
**Status:** Success ✅

The GitHub Actions workflow logs show:

```
Publishing to https://registry.modelcontextprotocol.io...
✓ Successfully published
✓ Server io.github.dynatrace-oss/dynatrace-managed-mcp version 0.4.0
```

### 2. Configuration Files

#### package.json

```json
{
  "name": "@dynatrace-oss/dynatrace-managed-mcp-server",
  "version": "0.4.0",
  "mcpName": "io.github.dynatrace-oss/dynatrace-managed-mcp"
}
```

#### server.json

```json
{
  "name": "io.github.dynatrace-oss/dynatrace-managed-mcp",
  "version": "0.4.0",
  "description": "Model Context Protocol server for Dynatrace Managed (self-hosted) - access logs, events, metrics, problems, and security data.",
  "repository": {
    "url": "https://github.com/dynatrace-oss/dynatrace-managed-mcp",
    "source": "github"
  }
}
```

### 3. Automated Publishing Workflow

The `.github/workflows/release.yml` includes these steps:

```yaml
- name: Install MCP Publisher
  run: |
    curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher

- name: Login to MCP Registry
  run: ./mcp-publisher login github-oidc

- name: Publish to MCP Registry
  run: ./mcp-publisher publish
```

## How It Works

### Automatic Publishing on Release

1. Developer creates a new git tag (e.g., `v0.5.0`)
2. GitHub Actions release workflow triggers automatically
3. Code is built, tested, and published to npm
4. MCP Publisher CLI:
   - Authenticates using GitHub OIDC (automatic, no secrets needed)
   - Validates `server.json` against the MCP schema
   - Publishes metadata to MCP registry
5. Server becomes discoverable at https://github.com/mcp/

### Authentication

Uses **GitHub OIDC authentication** which:

- Works automatically in GitHub Actions (no manual setup)
- Validates the repository is owned by `dynatrace-oss`
- Allows publishing to `io.github.dynatrace-oss/*` namespace

## MCP Registry Details

- **Server Name:** `io.github.dynatrace-oss/dynatrace-managed-mcp`
- **Description:** Model Context Protocol server for Dynatrace Managed (self-hosted) - access logs, events, metrics, problems, and security data.
- **Current Version:** 0.4.0
- **Package Registry:** npm
- **Package Name:** `@dynatrace-oss/dynatrace-managed-mcp-server`
- **Transport:** stdio
- **Schema:** https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json

## Verification

To verify the server is discoverable, users can:

1. **Search the MCP registry:**

   ```bash
   curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=dynatrace-managed"
   ```

2. **Visit GitHub MCP page:**
   - Go to https://github.com/mcp/
   - Search for "Dynatrace Managed"

3. **Install via npm:**
   ```bash
   npx @dynatrace-oss/dynatrace-managed-mcp-server@latest --help
   ```

## Next Steps

**None required.** The onboarding is complete and functional.

Future releases will automatically publish to the MCP registry when tagged.

## References

- [MCP Registry Documentation](https://github.com/modelcontextprotocol/registry)
- [Publishing Guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx)
- [GitHub Actions Publishing](https://github.com/modelcontextprotocol/registry/blob/main/docs/guides/publishing/github-actions.md)
