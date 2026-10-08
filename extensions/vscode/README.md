# Dynatrace Managed MCP Server

Bring observability data from your **Dynatrace Managed (self-hosted)** clusters directly into GitHub
Copilot and any other MCP-aware agent in VS Code.

> [!IMPORTANT]
> This extension is for **Dynatrace Managed**, the self-hosted deployment option. If you use
> Dynatrace SaaS (`*.apps.dynatrace.com`), use the
> [Dynatrace MCP server](https://docs.dynatrace.com/docs/shortlink/dynatrace-mcp-server) instead.

## What you get

Ask questions in natural language and let the agent pull the data it needs:

- _"Are there any open problems in the payment service right now?"_
- _"Show me error logs for cart-service from the last hour on the prod cluster."_
- _"Which of my hosts have critical vulnerabilities?"_
- _"Is the checkout SLO still within budget?"_

The server exposes 18 tools covering logs, metrics, events, entities, problems, security
vulnerabilities and SLOs, across **one or many** clusters at once.

## Why install the extension instead of configuring the server by hand

- **No prerequisites.** The MCP server is bundled inside the extension and runs on the Node.js
  runtime that ships with VS Code. You do not need Node.js on your `PATH`, and nothing is downloaded
  from the npm registry at startup — which matters on locked-down or air-gapped machines.
- **API tokens go in the OS keychain.** Credentials are stored in VS Code SecretStorage, not in
  `settings.json` or a `.env` file that can be committed by accident.
- **Guided setup.** A prompt walks you through cluster URL, environment ID, alias and token.
- **Proxy aware.** Inherits the VS Code `http.proxy` setting, or override it per protocol.

## Getting started

1. Install the extension.
2. Run **Dynatrace Managed MCP: Configure Clusters** from the Command Palette
   (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>).
3. Enter your cluster URL, environment ID, an alias and an API token.
4. Open Chat, switch to **Agent** mode, and ask about your environment.

You can add more clusters later by running the same command again. The alias is how you point the
agent at a specific cluster, for example _"check problems on the `staging` cluster"_.

### Required API token scopes

Create a token in your Dynatrace Managed environment under **Access tokens**. The tools need read
access to the data you intend to query:

| Capability                          | Scope                   |
| ----------------------------------- | ----------------------- |
| Cluster and environment information | `DataExport`            |
| Logs                                | `logs.read`             |
| Metrics                             | `metrics.read`          |
| Events                              | `events.read`           |
| Entities                            | `entities.read`         |
| Problems                            | `problems.read`         |
| Security vulnerabilities            | `securityProblems.read` |
| SLOs                                | `slo.read`              |

The full list, including which tool needs which scope, is in
[docs/api_token_scopes.md](https://github.com/dynatrace-oss/dynatrace-managed-mcp/blob/main/docs/api_token_scopes.md).

## Settings

| Setting                                  | Default   | Description                                                                  |
| ---------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| `dynatraceManagedMcp.runtime`            | `bundled` | `bundled` runs the server shipped in the extension; `npx` installs from npm. |
| `dynatraceManagedMcp.logLevel`           | `info`    | Server log verbosity.                                                        |
| `dynatraceManagedMcp.enableTelemetry`    | `false`   | Anonymous usage telemetry. Off by default.                                   |
| `dynatraceManagedMcp.rateLimit.maxCalls` | `20`      | Maximum tool calls per window.                                               |
| `dynatraceManagedMcp.rateLimit.windowMs` | `20000`   | Rate limit window in milliseconds.                                           |
| `dynatraceManagedMcp.httpProxy`          | _(empty)_ | Overrides `http.proxy` for plain HTTP requests to the cluster.               |
| `dynatraceManagedMcp.httpsProxy`         | _(empty)_ | Overrides `http.proxy` for HTTPS requests to the cluster.                    |

## Commands

| Command                                                     | What it does                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| `Dynatrace Managed MCP: Configure Clusters`                 | Add, remove or clear cluster configurations.                 |
| `Dynatrace Managed MCP: Clear Stored Cluster Configuration` | Delete all stored clusters and API tokens from the keychain. |

## Telemetry

Telemetry is **disabled by default**. When you opt in with
`dynatraceManagedMcp.enableTelemetry`, anonymous usage data is sent to Dynatrace to help prioritise
work. No observability data, cluster URLs or tokens are ever transmitted.

## Support

This extension is maintained on GitHub at
[dynatrace-oss/dynatrace-managed-mcp](https://github.com/dynatrace-oss/dynatrace-managed-mcp).
Please [open an issue](https://github.com/dynatrace-oss/dynatrace-managed-mcp/issues) for bugs and
feature requests. It is released under the
[Apache-2.0 licence](https://github.com/dynatrace-oss/dynatrace-managed-mcp/blob/main/LICENSE) and is
**not** covered by Dynatrace product support.
