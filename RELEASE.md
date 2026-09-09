# Release Process

This repository uses automated GitHub workflows to prepare releases whenever a new tag is pushed.

## How it works

1. When you push a tag starting with `v` (e.g., `v1.0.0`, `v2.1.3`), the release workflow automatically triggers
2. The workflow builds the project, runs tests, and creates a GitHub release with release notes extracted from [CHANGELOG.md](CHANGELOG.md) file

## Version-bearing manifests

The npm package version is declared in six files, and they must all agree before tagging:

| File                         | Field(s)                          |
| ---------------------------- | --------------------------------- |
| `package.json`               | `version`                         |
| `package-lock.json`          | `version`, `packages[""].version` |
| `server.json`                | `version`, `packages[].version`   |
| `plugin.json`                | `version`                         |
| `.cursor-plugin/plugin.json` | `version`                         |
| `.claude-plugin/plugin.json` | `version`                         |

`package.json` » `version` is the reference every other file is compared against.

`package-lock.json` is refreshed with `npm install --package-lock-only` after bumping
`package.json`. Note that `npm ci` succeeds against a stale root version and does not correct it, so
the lock file is only kept honest by this check.

The Claude Code manifest must move with every release even when only the skill changed: Claude Code
pins an installed plugin to that `version` string and hands users an update only when it changes.

## The npx major pin

Neither `mcp.json` nor `.mcp.json` carries a version of its own - the Agent
Plugins schema has no such field, and Claude Code takes the version from the plugin manifest. Both
instead pin the major their `npx` invocation may install (`@<2` today), so plugin installs pick up
patches and minors automatically but never an unvetted breaking major.

`npm run version:check` derives the required range from `package.json` » `version` and fails if
either manifest disagrees. Releasing `3.0.0` while a manifest still says `@<2` is therefore a hard
error rather than a silent strand of every plugin user on 2.x - widening the pin to `@<4` is a
deliberate step of the major release. Prerelease versions follow their own major, so `4.0.0-beta.1`
requires `@<5`.

The package identifier both manifests carry must match `package.json`, `package-lock.json` and
`server.json` » `packages[].identifier`.

## Other consistency checks

`npm run version:check` additionally asserts that the three plugin manifests agree on `name`, that the
`skills` and `mcpServers` paths in `.cursor-plugin/plugin.json` resolve to real files, and that every
variable the Cursor manifest marks `required` is actually referenced as `${...}` by an `mcp.json`
server - a required variable nothing reads is never prompted for, and a placeholder with no matching
variable reaches the server unexpanded.

For the Claude Code plugin it asserts the equivalent, plus two things `claude plugin validate` misses:

- The `skills` path in `.claude-plugin/plugin.json` resolves, and `.mcp.json` exists - otherwise the
  plugin installs without its skill or its MCP server.
- `.claude-plugin/plugin.json` does **not** declare `mcpServers` inline. An inline block passes
  `claude plugin validate` but Claude Code does not register it as a component, so the plugin would
  install with zero MCP servers. The servers belong in `.mcp.json`.
- Each `userConfig` option is read by exactly one `${user_config.<name>}` reference in `.mcp.json`.
  The same two failure modes as above apply: an unread option is prompted for and then dropped, and
  an undeclared reference reaches the server unexpanded.
- Every relative `source` in `.claude-plugin/marketplace.json` contains a
  `.claude-plugin/plugin.json`, each entry `name` matches the name in that manifest, and the Claude
  Code plugin is listed at all. `claude plugin validate` does **not** catch a marketplace source
  pointing at a nonexistent directory - it passes, and only the install fails - so this check is the
  one that guards it.

A missing or malformed manifest is reported the same way, rather than as a stack trace.

## Why the repository root is the plugin root

`.claude-plugin/plugin.json` sits at the repository root and the marketplace entry's `source` is
`"./"`, so the **repository itself is the Claude Code plugin**. That is what lets every catalog read
one `skills/` directory:

| File                              | Read by                       |
| --------------------------------- | ----------------------------- |
| `.claude-plugin/plugin.json`      | Claude Code                   |
| `.claude-plugin/marketplace.json` | Claude Code (catalog)         |
| `.mcp.json`                       | Claude Code (its MCP servers) |
| `plugin.json` + `mcp.json`        | Agent Plugins hosts           |
| `.cursor-plugin/plugin.json`      | Cursor                        |
| `skills/`                         | **all of the above**          |

A Claude Code plugin cannot reference files above its own root, so a plugin in a subdirectory would
need its own copy of every skill and something to keep the copies in step. Putting the manifests at
the root removes that problem entirely. This matches how other vendors ship the same combination -
see [`sanity-io/agent-toolkit`](https://github.com/sanity-io/agent-toolkit) and
[`exa-labs/exa-mcp-server`](https://github.com/exa-labs/exa-mcp-server).

The cost is that Claude Code auto-runs `npm ci --ignore-scripts` in the plugin cache whenever the
plugin root has a `package.json` and a lockfile, which it does here. That installs roughly 130 MB of
build tooling the plugin never uses, taking about 18 s, once per plugin version per machine. There
is no way to disable it, but a failure or 60 s timeout is non-blocking - it is wasted work, not a
broken install. This was a deliberate trade for keeping the skill in one place.

Manifest _schemas_ are checked separately with `claude plugin validate`, which needs the Claude Code
CLI on your `PATH`:

```bash
npm run plugin:validate
```

That runs the same `--strict` validation as the community-marketplace review pipeline, over both the
plugin and the marketplace manifest. Run it before submitting a plugin change or tagging a release.

It is deliberately **not** wired into CI. The `@anthropic-ai/claude-code` package ships a 180 KB
stub and downloads its native binary from a `postinstall` script, so installing it in a workflow
means executing a lifecycle script from a floating version on every run - and `--ignore-scripts`
leaves the CLI unable to start at all. `npm run version:check` covers the manifest failures that
actually break an install, and it needs no extra dependency.

`npm run version:check` asserts all of the above. It runs on every pull request, again at the start of
the release workflow, and once more against the pushed tag - so a tag that disagrees with the
manifests fails before anything is published to npm, GHCR or the MCP Registry.

```bash
npm run version:check
```

## Creating a Release

### Manual tagging

```bash
# Make sure you're on the main branch and have latest changes
git checkout main
git pull origin main

# Run tests and build locally (optional but recommended)
npm test
npm run build

# Create and push a tag
git tag vx.y.z  # Replace with your desired version
git push origin vx.y.z
```

After pushing the tag, the workflow will automatically:

1. Run tests
2. Build the project
3. Generate release notes from [CHANGELOG.md](CHANGELOG.md) file
4. Create a GitHub release

### Creating Pre-releases

For beta or alpha releases:

```bash
# Create a pre-release tag
git tag vx.y.z-beta.1
git push origin vx.y.z-beta.1
```

Pre-releases will be automatically marked as such in the GitHub release.

## Release Notes

The workflow automatically generates technical release notes by collecting all commit messages between the current and previous tag. The release notes include:

- A list of changes extracted from [CHANGELOG.md](CHANGELOG.md) file

## Plugin distribution

There is no manual step outside this repository for any plugin channel. Bumping the manifests and
pushing the tag is the whole release.

| Channel                                                              | What a release requires                                                                               |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `claude-community` (the documented install path)                     | Nothing. Anthropic's CI re-pins the approved commit SHA as commits land; the catalog syncs nightly    |
| This repository as a marketplace (`.claude-plugin/marketplace.json`) | Nothing. The entry uses a relative `source` and carries no version, so pushing to `main` publishes it |
| `claude-plugins-official`                                            | Nothing, by design - Anthropic curates it and there is no application process                         |

Two consequences worth knowing:

- Because both `.mcp.json` files pin only the major, **patch and minor server releases reach already
  installed plugin users without any plugin update** - `npx` resolves the new version on next
  launch. A plugin `version` bump only matters for manifest and skill changes.
- Third-party marketplaces have auto-update **disabled** by default, unlike Anthropic's own. Some
  users will need `/plugin marketplace update claude-community` to see a new plugin version.

The one-time submission to the community marketplace is done through
[platform.claude.com/plugins/submit](https://platform.claude.com/plugins/submit), or the
[claude.ai form](https://claude.ai/admin-settings/directory/submissions/plugins/new) if you have
directory-management access in the Dynatrace organization.
