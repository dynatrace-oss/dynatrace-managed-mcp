# Dynatrace Managed MCP Server

[![Latest Dynatrace Managed MCP Server releases](https://img.shields.io/github/release/dynatrace-oss/dynatrace-managed-mcp?color=c05240)](https://github.com/dynatrace-oss/dynatrace-managed-mcp/releases)
[![Dynatrace Managed MCP Server is released under the Apache 2.0 License](https://img.shields.io/badge/License-Apache_2.0-blue?color=7c38a1)](https://github.com/dynatrace-oss/dynatrace-managed-mcp/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/dm/@dynatrace-oss/dynatrace-managed-mcp-server?logo=npm&color=5ead35)](https://www.npmjs.com/package/@dynatrace-oss/dynatrace-managed-mcp-server)
[![Dynatrace Managed MCP Server Contributors on GitHub](https://img.shields.io/github/contributors/dynatrace-oss/dynatrace-managed-mcp?color=5ead35)](https://github.com/dynatrace-oss/dynatrace-managed-mcp)
[![Dynatrace Managed MCP Server Stars on GitHub](https://img.shields.io/github/stars/dynatrace-oss/dynatrace-managed-mcp)](https://github.com/dynatrace-oss/dynatrace-managed-mcp)

The _Dynatrace Managed MCP server_ allows AI Assistants to interact with one or more self-hosted [Dynatrace Managed](https://www.dynatrace.com/) deployments, bringing observability data directly into your AI-assisted workflow. It supports two modes: **local** (stdio, for development on your machine) and **remote** (HTTP, for distributed or production-like setups).

> [!TIP]
> This MCP server is specifically designed for Dynatrace Managed (self-hosted) deployments.
> For Dynatrace SaaS environments, please use the [Dynatrace MCP](https://github.com/dynatrace-oss/dynatrace-mcp).

## Capabilities

- **Problems** - List and get [problem](https://www.dynatrace.com/hub/detail/problems/) details from your services (for example Kubernetes)
- **Security** - List and get security problems / [vulnerability](https://www.dynatrace.com/hub/detail/vulnerabilities/) details
- **Entities** - Get more information about a monitored entity, including relationship mappings
- **SLO** - List and get Service Level Objective details, including evaluation and error budgets
- **Event Tracking** - List and get system events
- **Log Investigation** - Search and filter logs with advanced content and time-based queries
- **Metrics Analysis** - Query and analyze performance metrics using V2 Metrics API

For use cases and architecture, see [Overview](docs/overview.md).

> [!NOTE]
> This open source product is supported by the community.
> For feature requests, questions, or assistance, please use [GitHub Issues](https://github.com/dynatrace-oss/dynatrace-managed-mcp/issues).

## Prerequisites

- Node.js `>=26.5.1 <27` — `npm` refuses to install with `EBADENGINE` outside this range.
- Dynatrace Managed `1.328.0` or later.
- Network access from where the server runs to your cluster API endpoint (often port `9999`).

## Quickstart

This quickstart sets up **local (stdio) mode** — one person, one machine, the AI client launches the server itself. Setting up one server shared by a team instead? See [Set up remote (HTTP) mode](docs/setup-remote.md).

1. Create a Dynatrace API token with the required scopes — see [Create an API token](docs/api-token.md).

2. Create `~/.dynatrace/managed-mcp.yaml`:

   ```yaml
   - alias: production
     apiEndpointUrl: https://abc123.dynatrace-managed.com:9999
     environmentId: 01234567-89ab-cdef-abcd-ef0123456789
     apiToken: dt0c01.ABC123...
   ```

   Restrict its permissions — `chmod 600 ~/.dynatrace/managed-mcp.yaml` on macOS and Linux.

   Multiple environments, proxies and every other field: [Configuration reference](docs/configuration.md).

3. Add the server to your AI client:

   | Client             | Guide                                                   |
   | ------------------ | ------------------------------------------------------- |
   | Claude Code        | [Set up Claude Code](docs/clients/claude-code.md)       |
   | VS Code + Copilot  | [Set up VS Code](docs/clients/vs-code-copilot.md)       |
   | GitHub Copilot CLI | [Set up Copilot CLI](docs/clients/copilot-cli.md)       |
   | Claude Desktop     | [Set up Claude Desktop](docs/clients/claude-desktop.md) |

   Cursor, Windsurf, Kiro, Gemini CLI and ChatGPT: [other clients](docs/clients/other-clients.md).

4. Ask your assistant: `Ask Dynatrace to list problems`. Success looks like the assistant calling a Dynatrace tool and returning problems from the environment aliased `production`.

   Nothing happening? [Troubleshooting](docs/troubleshooting.md).

## Documentation

| Page                                                        | Description                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| [Documentation home](docs/README.md)                        | Full documentation index.                                    |
| [Create an API token](docs/api-token.md)                    | Scopes and steps for creating a Dynatrace Managed token.     |
| [Set up local (stdio) mode](docs/setup-local.md)            | Run the server on your machine for development.              |
| [Set up remote (HTTP) mode](docs/setup-remote.md)           | Run the server as an HTTP service for shared/production use. |
| [Set up Claude Code](docs/clients/claude-code.md)           | Add the server to Claude Code.                               |
| [Set up VS Code + Copilot](docs/clients/vs-code-copilot.md) | Add the server to VS Code with GitHub Copilot.               |
| [Set up GitHub Copilot CLI](docs/clients/copilot-cli.md)    | Add the server to GitHub Copilot CLI.                        |
| [Set up Claude Desktop](docs/clients/claude-desktop.md)     | Add the server to Claude Desktop.                            |
| [Other clients](docs/clients/other-clients.md)              | Cursor, Windsurf, Kiro, Gemini CLI and ChatGPT.              |
| [Configuration reference](docs/configuration.md)            | Every configuration field and environment variable.          |
| [Multi-environment setup](docs/multi-environment.md)        | Configuring and querying more than one environment.          |
| [Hybrid SaaS + Managed setup](docs/hybrid-saas-managed.md)  | Running this server alongside the Dynatrace SaaS MCP.        |
| [Troubleshooting](docs/troubleshooting.md)                  | Diagnosing authentication, connectivity and startup issues.  |
| [Overview](docs/overview.md)                                | Use cases and architecture diagrams.                         |
| [Example prompts](examples/README.md)                       | Sample prompts to try with your AI assistant.                |
| [Development guide](docs/DEVELOPMENT.md)                    | Building, testing and contributing code.                     |

## Telemetry

Telemetry is enabled by default and collects anonymous usage and error data only. Disable it by setting `DT_MCP_DISABLE_TELEMETRY` to `true`. For the full list of telemetry options, see the [Configuration reference](docs/configuration.md).

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

This open source project is supported by the community. For feature requests, questions, or assistance, please use [GitHub Issues](https://github.com/dynatrace-oss/dynatrace-managed-mcp/issues).

## License

Released under the [Apache 2.0 License](LICENSE).
