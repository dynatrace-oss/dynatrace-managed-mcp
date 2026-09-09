# Dynatrace Managed plugin for Claude Code

This repository is itself the [Claude Code plugin](https://code.claude.com/docs/en/plugins) for the
Dynatrace Managed MCP server: the manifests live in `.claude-plugin/` at the repository root, so the
plugin root and the repository root are the same directory.

## Install

The plugin is published through Anthropic's community plugin marketplace:

```shell
/plugin marketplace add anthropics/claude-plugins-community
/plugin install dynatrace-managed-mcp@claude-community
```

Both commands are required: `@claude-community` is a local alias for a catalog Claude Code has
already cloned, not an address it can resolve on its own, so `/plugin install` alone fails with
`not found in any configured marketplace`.

> [!IMPORTANT]
> The community marketplace listing is pending review. Until it is approved and the catalog's
> nightly sync has run, use the repository marketplace below.

This repository is also a [plugin marketplace](../.claude-plugin/marketplace.json) in its own right,
which is how you install the plugin before the community listing is approved, try an unreleased
change, or pin to a branch:

```shell
/plugin marketplace add dynatrace-oss/dynatrace-managed-mcp
/plugin install dynatrace-managed-mcp@dynatrace
```

Claude Code prompts for the cluster configuration during install. Supply **either**:

- **Dynatrace Managed environments** - a JSON array for a single cluster. Stored in the OS keychain
  because it contains an API token, which caps it at roughly 2 KB in total.
- **Environment configuration file** - a path to a JSON or YAML file. Preferred for more than one
  cluster: it takes priority over the value above, and `apiToken: ${DT_PROD_TOKEN}` placeholders are
  interpolated at runtime, so only the path reaches secure storage.

See [api_token_scopes.md](api_token_scopes.md) for the read-only scopes the token needs and
[environment_variables.md](environment_variables.md) for the full variable list.

## What Claude Code reads

| Path                              | Purpose                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `.claude-plugin/plugin.json`      | Manifest: identity, `skills` path, and the `userConfig` options prompted for     |
| `.claude-plugin/marketplace.json` | Catalog entry, with `source` set to `"./"`                                       |
| `.mcp.json`                       | Declares the `dynatrace-managed` stdio server and maps `userConfig` into its env |
| `skills/dynatrace-managed/`       | Agent Skill covering setup, environment selection and entity selectors           |

Everything else in the repository is ignored by Claude Code.

The plugin ships no code of its own: `.mcp.json` runs the published npm package through `npx`,
pinned to the current major so patch and minor server releases reach installed users without a
plugin update.

Two things are easy to get wrong here:

- **The MCP servers must live in `.mcp.json`, not inline in `plugin.json`.** An inline `mcpServers`
  block passes `claude plugin validate`, but Claude Code does not register it, and the plugin
  installs with zero MCP servers. `npm run version:check` rejects an inline block for that reason.
- **`.mcp.json` is not `mcp.json`.** The dotted file is Claude Code's and uses
  `${user_config.<name>}` placeholders; the undotted one is the Agent Plugins manifest that
  `.cursor-plugin/plugin.json` reads and uses `${VAR}` placeholders. They are not interchangeable.

Because the plugin root is the repository root, all of Claude Code, Agent Plugins hosts and Cursor
read the same top-level `skills/` directory - there is no second copy of any skill to keep in sync.
See [RELEASE.md](../RELEASE.md) for why that layout was chosen and what it costs.

## Develop and test

```shell
# Load the plugin straight from the working tree, no install required
claude --plugin-dir .

# Exercise the real marketplace, install and userConfig prompt flow
/plugin marketplace add ./
/plugin install dynatrace-managed-mcp@dynatrace
```

Use `./`, not `.`, for `marketplace add` - a bare dot is rejected as an invalid source format.

After editing anything the plugin reads, run `/reload-plugins` rather than restarting.

> [!NOTE]
> `npx` resolves `@dynatrace-oss/dynatrace-managed-mcp-server` from a local `package.json` when one
> satisfies the range, so running the plugin **inside this repository** makes the MCP server fail
> with `'mcp-server-dynatrace' is not recognized`. Test the server from any other directory.

Validate both manifests the way the community-marketplace review pipeline does, before submitting a
change:

```shell
npm run plugin:validate
```

That script calls `claude plugin validate`, so it needs the Claude Code CLI on your `PATH`, which is
why it runs locally rather than in CI - see [RELEASE.md](../RELEASE.md) for the reasoning.
`npm run version:check` runs in CI and covers the rest: that the manifest version matches every
other version-bearing file, that the `skills` path resolves, that `.mcp.json` exists and declares no
inline servers, and that each `userConfig` option is actually read by a server in `.mcp.json`.

## Releasing

Bumping `.claude-plugin/plugin.json` » `version` is part of the normal release, described in
[RELEASE.md](../RELEASE.md). Users only receive plugin updates when that `version` changes, so it
must move with every release even when only the skill changed.
