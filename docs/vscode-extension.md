# Dynatrace Managed extension for VS Code

The VS Code extension lives in [`extensions/vscode/`](../extensions/vscode) and is published to the
[Visual Studio Marketplace](https://marketplace.visualstudio.com/). It is a separate npm package from
the server at the repository root.

## Install

```shell
code --install-extension dynatrace.dynatrace-managed-mcp
```

Or search for **Dynatrace Managed MCP Server** in the Extensions view. Then run
**Dynatrace Managed MCP: Configure Clusters** from the Command Palette, which prompts for the
cluster URL, environment ID, alias and API token.

Every tagged release also attaches the `.vsix` to its
[GitHub release](https://github.com/dynatrace-oss/dynatrace-managed-mcp/releases) for machines that
cannot reach the Marketplace:

```shell
code --install-extension dynatrace-managed-mcp-1.1.1.vsix
```

See [api_token_scopes.md](api_token_scopes.md) for the read-only scopes the token needs.

## Two ways to be listed in VS Code, and why both exist

| Surface                                   | Backed by                                                    | How it is published                             |
| ----------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Extensions view → `@mcp`                  | GitHub MCP Registry, which mirrors the official MCP Registry | `publish-mcp-registry` job, from `server.json`  |
| Extensions view → normal extension search | Visual Studio Marketplace                                    | `publish-vscode` job, from `extensions/vscode/` |

The `@mcp` gallery entry comes for free with the MCP Registry publish and needs no extension. The
extension exists for what the gallery entry cannot offer:

- **No prerequisites.** The gallery entry hands VS Code an `npx` command, so it needs Node.js on the
  user's `PATH` and a reachable npm registry. The extension bundles the server and runs it on the
  Node.js runtime inside VS Code. For a self-hosted product whose users are frequently air-gapped,
  this is the whole point.
- **Tokens in the OS keychain.** The gallery entry can only prompt into `mcp.json`. The extension
  stores `DT_ENVIRONMENT_CONFIGS` in VS Code SecretStorage.

## Why the extension is a separate package

The root `package.json` cannot carry `publisher`, `engines.vscode` or `contributes`, and `vsce`
packages the whole directory it runs in - which at the repository root would mean the full build
toolchain. Unlike the Claude Code plugin, which
[has to be rooted at the repository root](claude-code-plugin.md), nothing forces the extension to
share a directory with the server: `esbuild` reads `../../src` at build time, so the two packages
share source without sharing a manifest.

## How the server is launched

`src/extension.ts` registers a provider against the `dynatrace-managed` contribution point and
returns a `McpStdioServerDefinition`. In the default `bundled` runtime that definition is:

| Field     | Value                                                    |
| --------- | -------------------------------------------------------- |
| `command` | `process.execPath` - the Node.js runtime inside VS Code  |
| `args`    | `dist/mcp/server.js` inside the extension install folder |
| `env`     | `ELECTRON_RUN_AS_NODE=1`, plus the settings below        |

`ELECTRON_RUN_AS_NODE=1` is what makes the VS Code binary behave as a plain `node`. This is the
reason the root `engines.node` is `>=24` rather than tracking
[`.nvmrc`](../.nvmrc): the extension host ships its own Node.js, currently 24.x, and the server has
to run on it. Widening that range is a hard requirement of the bundled runtime, not a preference -
raising it back above the extension host version silently breaks this extension.

Setting `dynatraceManagedMcp.runtime` to `npx` switches `command` back to `npx` with the published
package, for users who would rather track npm releases than extension releases. The package and its
major pin come from the `dynatraceManagedMcpServer` block of the extension manifest, which
`npm run version:check` keeps in step with the root `package.json` exactly as it does for
[`mcp.json`](../mcp.json).

`DT_ENVIRONMENT_CONFIGS` is deliberately **not** part of the definition returned by
`provideMcpServerDefinitions`. VS Code may cache and persist that result, so the API token is added
only in `resolveMcpServerDefinition`, which runs immediately before the server process starts. When
the user dismisses the configuration prompt, `resolveMcpServerDefinition` returns `undefined` and
the server is not started at all, instead of launching a process that would fail on a missing
configuration.

## Settings

All settings live under `dynatraceManagedMcp.*` and are mapped onto the server's environment
variables in `buildEnvironment()`. `httpProxy` and `httpsProxy` fall back to the VS Code `http.proxy`
setting, so a corporate proxy only has to be configured once. `LOG_OUTPUT` is pinned to
`stderr-all`: stdout is the stdio transport, and the default winston file transport cannot write
inside the extension install directory - the same constraint the
[`Dockerfile`](../Dockerfile) works around.

A change to any of these fires `onDidChangeMcpServerDefinitions`, which is how VS Code learns to
re-read the definition instead of reusing the one it started the current process with.

## The listing icon

`icon` in a VS Code manifest has to resolve inside the extension folder, so `esbuild.mjs` copies the
shared asset in at build time rather than committing the same PNG twice. Both ends of that copy come
from the manifest - `iconSource` (the committed asset) and `icon` (the copy) - so nothing can drift,
and `extensions/vscode/icon.png` is gitignored.

The Marketplace requires at least **128x128**, but `vsce package` does not check: a smaller icon
packages cleanly and is only rejected once the release job is already uploading. `npm run
version:check` therefore reads the width and height out of the PNG header itself and fails on the
pull request instead.

## Development

```shell
npm ci --ignore-scripts                      # repository root: the server's dependencies
cd extensions/vscode
npm ci --ignore-scripts
npm run build                                # bundles dist/extension.js and dist/mcp/server.js
npm run watch                                # same, rebuilding on change
npm run typecheck
npm run package                              # produces dynatrace-managed-mcp.vsix
```

The root install is required: `esbuild` resolves `axios`, `winston` and the MCP SDK from the
repository root when it bundles `../../src/index.ts`.

Press <kbd>F5</kbd> to launch an Extension Development Host. To exercise the bundled server without
VS Code at all:

```shell
LOG_OUTPUT=stderr-all node extensions/vscode/dist/mcp/server.js --help
```

## Publishing

Handled by the `publish-vscode` job in
[`release.yml`](../.github/workflows/release.yml) on every `v*` tag. It runs after
`github-release`, so a failed npm publish can never leave a Marketplace listing pointing at a
version that does not exist, and so the `.vsix` can be attached to a release that already exists.

Prereleases are skipped: the Marketplace only accepts strict `x.y.z` versions, so a tag like
`v1.2.0-beta.1` ships to npm, GHCR and the MCP Registry only.

One repository secret is required:

| Secret     | Used for                                                                           |
| ---------- | ---------------------------------------------------------------------------------- |
| `VSCE_PAT` | Visual Studio Marketplace, via an Azure DevOps token with **Marketplace → Manage** |

> [!IMPORTANT]
> Azure DevOps global PATs are retired on **1 December 2026**. `VSCE_PAT` has to be migrated to
> Microsoft Entra ID workload identity federation before then, or the release job starts failing.

The extension is published under the existing **`dynatrace`** publisher, which already ships
Dynatrace Apps and Dynatrace Live Debugger. Publishing requires membership of that publisher; a new
`dynatrace-oss` publisher would be unverified, and Marketplace verification needs both six months of
publishing history and a six-month-old registered domain.

### Outstanding before the first publish

- [ ] Membership of the `dynatrace` Marketplace publisher, and the `VSCE_PAT` secret.
- [x] A listing icon - [`assets/Dt_Logo.png`](../assets/Dt_Logo.png), 230x230. Trademark sign-off is
      still worth confirming with GO-TO-MARKET before the first publish.
