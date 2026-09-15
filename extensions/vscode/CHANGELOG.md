# Changelog

All notable changes to the Dynatrace Managed MCP Server extension are documented here. The
changelog of the underlying MCP server is kept in
[CHANGELOG.md](https://github.com/dynatrace-oss/dynatrace-managed-mcp/blob/main/CHANGELOG.md) at the
repository root.

## 1.1.1

Initial Marketplace release.

- Registers the Dynatrace Managed MCP server with VS Code through
  `contributes.mcpServerDefinitionProviders`, so it appears in the MCP server list without editing
  `mcp.json` by hand.
- Bundles the MCP server inside the extension and runs it on the Node.js runtime that ships with
  VS Code. No Node.js on `PATH` and no npm registry access are required.
- Stores cluster API tokens in VS Code SecretStorage (the OS keychain) instead of `settings.json`.
- Adds a guided **Configure Clusters** command supporting multiple clusters, and a command to clear
  stored credentials.
- Inherits the VS Code `http.proxy` setting, with per-protocol overrides.
- Adds an opt-in `npx` runtime mode for users who would rather track npm releases than extension
  releases.
