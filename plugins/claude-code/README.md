# Dynatrace Managed plugin for Claude Code

This directory is the [Claude Code plugin](https://code.claude.com/docs/en/plugins) for the Dynatrace
Managed MCP server. It is the plugin root: everything Claude Code reads lives here, and nothing
above this directory is part of the plugin.

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

The repository root is also a [plugin marketplace](../../.claude-plugin/marketplace.json) in its own
right, which is how you install the plugin before the community listing is approved, try an
unreleased change, or pin to a branch:

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

See [docs/api_token_scopes.md](../../docs/api_token_scopes.md) for the read-only scopes the token
needs and [docs/environment_variables.md](../../docs/environment_variables.md) for the full variable
list.

## Contents

| Path                         | Purpose                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `.claude-plugin/plugin.json` | Manifest: identity, `skills` path, and the `userConfig` options prompted for     |
| `.mcp.json`                  | Declares the `dynatrace-managed` stdio server and maps `userConfig` into its env |
| `skills/dynatrace-managed/`  | Agent Skill covering setup, environment selection and entity selectors           |

The plugin ships no code. `.mcp.json` runs the published npm package through `npx`, pinned to the
current major so patch and minor server releases reach installed users without a plugin update. The
plugin root deliberately has no `package.json` or lockfile, because Claude Code would otherwise run
`npm ci` against it on every install and update.

`skills/dynatrace-managed/SKILL.md` is a copy of the one at the repository root. A Claude Code
plugin cannot reference files above its own root, so the plugin needs its own. Edit both when
changing the skill, until the root copy's only remaining consumer is removed.

## Develop and test

```shell
# Load the plugin straight from the working tree, no install required
claude --plugin-dir ./plugins/claude-code

# Exercise the real marketplace, install and userConfig prompt flow
/plugin marketplace add .
/plugin install dynatrace-managed-mcp@dynatrace
```

After editing anything here, run `/reload-plugins` rather than restarting.

Validate both manifests the way CI and the community-marketplace review pipeline do:

```shell
npm run plugin:validate
```

That script calls `claude plugin validate`, so it needs the Claude Code CLI on your `PATH`.
`npm run version:check` covers the rest: that the manifest version matches every other
version-bearing file, that the `skills` path resolves, and that each `userConfig` option is actually
read by a server in `.mcp.json`.

## Releasing

Bumping the version here is part of the normal release, described in
[RELEASE.md](../../RELEASE.md). Users only receive plugin updates when this `version` changes, so it
must move with every release even when only the skill changed.
