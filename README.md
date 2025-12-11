# Dynatrace Managed MCP Server

<h4 align="center">
  <a href="https://github.com/dynatrace-oss/dynatrace-managed-mcp/releases">
    <img src="https://img.shields.io/github/release/dynatrace-oss/dynatrace-managed-mcp" />
  </a>
  <a href="https://github.com/dynatrace-oss/dynatrace-managed-mcp/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-mit-blue.svg" alt="Dynatrace Managed MCP Server is released under the MIT License" />
  </a>
  <a href="https://www.npmjs.com/package/@dynatrace-oss/dynatrace-managed-mcp">
    <img src="https://img.shields.io/npm/dm/@dynatrace-oss/dynatrace-managed-mcp?logo=npm&style=flat&color=red" alt="npm" />
  </a>
  <a href="https://github.com/dynatrace-oss/dynatrace-managed-mcp">
    <img src="https://img.shields.io/github/stars/dynatrace-oss/dynatrace-managed-mcp" alt="Dynatrace Managed MCP Server Stars on GitHub" />
  </a>
  <a href="https://github.com/dynatrace-oss/dynatrace-managed-mcp">
    <img src="https://img.shields.io/github/contributors/dynatrace-oss/dynatrace-managed-mcp?color=green" alt="Dynatrace Managed MCP Server Contributors on GitHub" />
  </a>
</h4>

The local _Dynatrace Managed MCP server_ allows AI Assistants to interact with self-hosted [Dynatrace Managed](https://www.dynatrace.com/) deployments,
bringing observability data directly into your AI assisted workflow.

This MCP server is specifically designed for Dynatrace Managed (self-hosted) deployments. There is a different
[Dynatrace MCP](https://github.com/dynatrace-oss/dynatrace-mcp) server for use with Dynatrace SaaS.

> Note: This product is not officially supported by Dynatrace.

If you need help, please contact us via [GitHub Issues](https://github.com/dynatrace-oss/dynatrace-managed-mcp/issues) if you have feature requests, questions, or need help.

## Quickstart

You can add this MCP server to your AI Assistant such as VSCode, Claude, Cursor, Kiro, Windsurf, ChatGPT, or Github Copilot.
For more details, please refer to the [configuration section below](#configuration).

You need to configure the connection to your Dynatrace Managed environment:

- `DT_MANAGED_ENVIRONMENT` (string, e.g., `https://managed.company.com:9999/e/e0a90c2f-89ab-43c7-9ff7-ec75449c1aba`) - URL to your Managed cluster
- `DT_MANAGED_API_TOKEN` (string) - API token with required scopes (see [Authentication](#authentication))

Once configured, you can start using [example prompts](#Example-Prompts) like `Get all details of the Dynatrace entity 'my-service'`
or `What problems has Dynatrace identified? Give details of the first problem.`.

These queries use V2 REST APIs and do not incur additional costs beyond your standard Managed license.

Minimum supported version: Dynatrace Managed 1.328.0

## Architecture

![Architecture](./assets/dynatrace-managed-mcp-arch.png?raw=true)

## Use cases

There are two ways that Dynatrace Managed, and thus the MCP, may be used:

1. Dynatrace Managed is the primary Observability system, containing all live data; or
2. There has been a migration from Dynatrace Managed to Dynatrace Saas, however historical observability data has not been migrated and can still be access via Dynatrace Managed.
   The Dynatrace Managed MCP is used to access historical data, and a separate Dynatrace SaaS MCP is used to access live and more recent data.

Specific use cases for the Dynatrace Managed MCP include:

- **Real-time observability** - Fetch production-level data for early detection and proactive monitoring
- **Contextual debugging** - Fix issues with full context from monitored exceptions, logs, and anomalies
- **Security insights** - Get detailed vulnerability analysis and security problem tracking. This can include multi-cloud compliance assessment with evidence-based investigation.
- **Natural language queries** - Queries are mapped to MCP tool usage, and thus API queries, with guidance for next step
- **Multiphase incident investigation** - Systematic impact assessment and troubleshooting

## Capabilities

- **Problems** - List and get [problem](https://www.dynatrace.com/hub/detail/problems/) details from your services (for example Kubernetes)
- **Security** - List and get security problems / [vulnerability](https://www.dynatrace.com/hub/detail/vulnerabilities/) details
- **Entities** - Get more information about a monitored entity, including relationship mappings
- **SLO** - List and get Service Level Objective details, including evaluation and error budgets
- **Event Tracking** - List and get system events
- **Log Investigation** - Search and filter logs with advanced content and time-based queries
- **Metrics Analysis** - Query and analyze performance metrics using V2 Metrics API

### Performance Considerations

**Important:** This MCP server is makes API calls to the Dynatrace Managed environment. It is designed for efficient usage (e.g. limiting the response sizes),
but care should be taken to not overload the Dynatrace Managed with large queries.

**Best Practices:**

1. Use specific time ranges (e.g., 1-2 hours) rather than large historical queries.
2. Use specific filters to limit the scope of queries as much as possible, for example entity selectors that specify the entity id.

## Configuration

You can add this MCP server (using STDIO or HTTP) to your AI Assistant.

We recommend to always set it up for your current workspace instead of using it globally.

**VS Code**

```json
{
  "servers": {
    "npx-dynatrace-managed-mcp": {
      "command": "npx",
      "cwd": "${workspaceFolder}",
      "args": ["-y", "@dynatrace-oss/dynatrace-managed-mcp-server@latest"],
      "envFile": "${workspaceFolder}/.env"
    }
  }
}
```

Please note: In this config, [the `${workspaceFolder}` variable](https://code.visualstudio.com/docs/reference/variables-reference#_predefined-variables) is used.
This only works if the config is stored in the current workspaces, e.g., `<your-repo>/.vscode/mcp.json`. Alternatively, this can also be stored in user-settings, and you can define `env` as follows:

```json
{
  "servers": {
    "npx-dynatrace-managed-mcp": {
      "command": "npx",
      "args": ["-y", "@dynatrace-oss/dynatrace-managed-mcp-server@latest"],
      "env": {
        "DT_MANAGED_ENVIRONMENT": "https://managed.company.com",
        "DT_MANAGED_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

**Claude Desktop**

```json
{
  "mcpServers": {
    "dynatrace-managed-mcp": {
      "command": "npx",
      "args": ["-y", "@dynatrace-oss/dynatrace-managed-mcp-server@latest"],
      "env": {
        "DT_MANAGED_ENVIRONMENT": "https://managed.company.com",
        "DT_MANAGED_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

**Kiro**

[Amazon Kiro](https://kiro.dev/) is an agentic IDE; and [Kiro CLI](https://kiro.dev/docs/cli/mcp/) provides an interactive chat experience directly in your terminal.

```json
{
  "mcpServers": {
    "dynatrace-managed-mcp": {
      "command": "npx",
      "args": ["-y", "@dynatrace-oss/dynatrace-managed-mcp-server@latest"],
      "env": {
        "DT_MANAGED_ENVIRONMENT": "https://managed.company.com",
        "DT_MANAGED_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

This configuration should be stored in `<project-root>/.kiro/settings/mcp.json`, or in user-level settings (`~/.kiro/settings/mcp.json`).

**Google Gemini CLI**

The [Google Gemini CLI](https://github.com/google-gemini/gemini-cli) is Google's official command-line AI assistant that supports MCP server integration. You can add the Dynatrace MCP server using either the built-in management commands or manual configuration.

Using `gemini` CLI directly (recommended):

```bash
gemini extensions install https://github.com/dynatrace-oss/dynatrace-managed-mcp
export DT_MANAGED_ENVIRONMENT="https://managed.company.com"
export DT_MANAGED_API_TOKEN="your-api-token"
```

and verify that the server is running via

```bash
gemini mcp list
```

Or manually in your `~/.gemini/settings.json` or `.gemini/settings.json`:

```json
{
  "mcpServers": {
    "dynatrace-managed-mcp": {
      "command": "npx",
      "args": ["@dynatrace-oss/dynatrace-managed-mcp-server@latest"],
      "env": {
        "DT_MANAGED_ENVIRONMENT": "https://managed.company.com",
        "DT_MANAGED_API_TOKEN": "your-api-token"
      },
      "timeout": 30000,
      "trust": false
    }
  }
}
```

### HTTP Server Mode (Alternative)

The default mode for this local MCP is using stdio for the transport.

For scenarios where you need to run the MCP server as an HTTP service instead, you can use the HTTP server mode
(e.g., for stateful sessions, load balancing, or integration with web clients):

**Running as HTTP server:**

```bash
# Get help and see all available options
npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest --help

# Run with HTTP server on default port 3000
npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest --http

# Run with custom port
npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest --http --port 3001

# Run with custom host/IP
npx -y @dynatrace-oss/dynatrace-mcp-server@latest --http --host 127.0.0.1   # recommended for local computers
npx -y @dynatrace-oss/dynatrace-mcp-server@latest --http --host 0.0.0.0     # recommended for container
npx -y @dynatrace-oss/dynatrace-mcp-server@latest --http --host 192.168.0.1 # recommended when sharing connection over a local network

# Check version
npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest --version
```

**Configuration for MCP clients that support HTTP transport:**

```json
{
  "mcpServers": {
    "dynatrace-managed-mcp": {
      "url": "http://localhost:3000",
      "transport": "http"
    }
  }
}
```

### Rule File

For efficient result retrieval from Dynatrace, please consider creating a rule file (e.g.,
[.github/copilot-instructions.md](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions),
[.amazonq/rules/](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/context-project-rules.html)),
instructing coding agents on how to get more details for your component/app/service.

Here is an example for someone who is responsible for the [easytrade](https://github.com/Dynatrace/easytrade) system,
who therefore wants to focus on entities and problems relating to easytrade.

Please adapt the names and filters to fit your use-cases, components, tagging strategy, deployment environment, etc.

#### Example Rule File:

```markdown
# Dynatrace

We use Dynatrace Managed as our Observability solution. This document provides instructions on how to get data for
the easytrade system from Dynatrace using the Dynatrace Managed MCP.

## Best Practices

1. Always use specific time ranges, keeping these narrow (e.g. now-1h, now-24h), to avoid large data queries.
2. For entity selectors, consider using criteria for tags for more precise filtering (if the tagging strategy and naming is understood).

## Entity Selectors for easytrade

Consider using these criteria in the entitySelector to filter data for our easytrade application:

Services:

- `type(SERVICE),entityName.contains("easytrade")`
- `type(SERVICE),tag("app:easytrade")`

Process Groups & Containers:

- `type(PROCESS_GROUP),entityName.contains("easytrade")`
- `type(CONTAINER_GROUP_INSTANCE),entityName.contains("easytrade")`

Hosts:

- `type(HOST),tag("environment:production"),tag("app:easytrade")`

AWS Lambda Functions:

- `type(AWS_LAMBDA_FUNCTION),entityName.contains("easytrade")`
- `type(AWS_LAMBDA_FUNCTION),tag("AWS_REGION:us-west-2"),tag("app:easytrade")`
```

## Environment Variables

- `DT_MANAGED_ENVIRONMENT` - URL to your Managed cluster (e.g., `https://managed.company.com:9999/e/e0a90c2f-89ab-43c7-9ff7-ec75449c1aba`)
- `DT_MANAGED_API_TOKEN` - API token with required scopes (see [Authentication](#authentication))
- `LOG_LEVEL` - Log level, writing to dynatrace-managed-mcp.log in the current working directory (e.g. debug, info, warning, error)
- `HTTP_PROXY` - HTTP Proxy for corporate environments, to route traffic through (e.g. http://proxy.company.com:8080)
- `HTTPS_PROXY` - HTTPS Proxy for corporate environments, to route traffic through (e.g. https://proxy.company.com:8080)

**Proxy Configuration**

The MCP server honors system proxy settings for corporate environments:

- `HTTPS_PROXY` (optional, string, e.g., `http://proxy.company.com:8080`) - Proxy server URL for HTTPS requests; or
- `HTTP_PROXY` (optional, string, e.g., `http://proxy.company.com:8080`) - Proxy server URL for HTTP requests

Example configuration with proxy:

```bash
export HTTP_PROXY=http://proxy.company.com:8080
```

## Authentication

Dynatrace Managed uses API token-based authentication. Create an API token in your Managed cluster with the required scopes (see next subsection).

For more information about creating API tokens in Managed deployments, refer to the
[Dynatrace Managed documentation](https://docs.dynatrace.com/managed/discover-dynatrace/references/dynatrace-api/basics/dynatrace-api-authentication).

### API Scopes for Managed Deployment

Your API token must include the following scopes for full functionality:

**Required Scopes:**

- Read audit logs (`auditLogs.read`)
- Read entities (`entities.read`)
- Read events (`events.read`)
- Read logs (`logs.read`)
- Read metrics (`metrics.read`)
- Read network zones (`networkZones.read`)
- Read problems (`problems.read`)
- Read security problems (`securityProblems.read`)
- Read SLO (`slo.read`)

**Note**: API token scopes in Managed deployments differ from SaaS Platform tokens. Ensure you select the correct scopes for your Managed cluster version.

## Key Differences from SaaS Dynatrace MCP

This MCP is for Dynatrace Managed platforms. There is a different [Dynatrace MCP](https://github.com/dynatrace-oss/dynatrace-mcp) server for using with Dynatrace SaaS.

Key difference include:

- Dynatrace SaaS MCP uses DQL, whereas Dynatrace Managed uses the v2 APIs
- Dynatrace SaaS MCP uses Davis CoPilot, whereas Dynatrace Managed does not
- Dynatrace SaaS MCP ues OAuth, whereas Dynatrace Managed uses API Tokens

## Hybrid Setup with both Dynatrace SaaS MCP and Dynatrace Managed MCP

This Managed Dynatrace MCP can be run alongside the SaaS Dynatrace MCP to enable a hybrid setup between your self-hosted
and SaaS Dynatrace environments. This can be useful if you run your applications in a hybrid fashion, but also supports
migration scenarios where you have moved to Dynatrace SaaS but still have historical data in your Managed platform that
you won't migrate across. In this scenario your MCP client can be configured to talk to both MCP servers simultaneously,
enabling you to query across SaaS and Managed data.

To set this up, you should:

1. Follow the [instructions above](#configuration) to set up this Dynatrace Managed MCP server
2. Follow the [instructions for Dynatrace SaaS MCP](https://github.com/dynatrace-oss/dynatrace-mcp) to set it up, making
   sure to name the two servers differently in your MCP config file
3. In your AI Assistant, confirm that it is connected to both
4. (optional, but recommended) Set up rules or steering for your AI Assistant to give it clear guidance on using both MCPs

Once you have both MCP servers configured, you can ask questions which your MCP client should pass back to the right MCP
Server (or to both, where appropriate).

Note that if you do not include rules or steering for your MCP client, queries such as `Ask Dynatrace to list application problems from the last 24 hours`
might use one MCP server or both, depending on what is in your context window. If you choose to proceed this way, make sure that
your commands are **very** specific, e.g. `Ask Dynatrace to list application problems from the last 24 hours in my Managed envrionment`.

### Rules/Steering

AI Assistants usually support rules files to give steering guidance for their use (see [Rule File](#rule-file) for configuration information).

If you are using this MCP server in a hybrid setup alongside the SaaS MCP server, it is recommended to add this to your configuration to prevent the AI Assistant from using the wrong MCP or getting confused.

Your steering rules will be unique to your setup, but some recommended templates are included below for you to use as a starter.
You can edit these as you see fit and include additional context that is specific to your environments.

#### Hybrid setup with migration date

In this example, you have migrated from Managed to SaaS, but still have historic data in your self-hosted Managed environment.
You want your AI Assistant to have context on what data lives where. This will enable it to know which environments to target
for the date range you ask for, e.g. `Show me all Dynatrace problems from the last 7 days` may require data from both environments
(and thus use both MCP servers), or may all reside in just the SaaS environment.

```text
# Dynatrace

- I have two separate Dynatrace environments:
   1. Dynatrace Managed is self-hosted. It contains only historical data from before 29th November 2025.
      It is accessed via the Dynatrace Managed MCP, named dynatrace-managed-mcp-server
   2. Dynatrace SaaS is used for all live data.
      It is accessed through the Dynatrace SaaS MCP, named dynatrace-saas-mcp-server
- Be careful of which MCP to use.
  If it is unclear, ask which MCP to use.
- Must make it very clear to the user whether data has come from the Dynatrace Managed or Dynatrace SaaS environments.
```

#### Hybrid setup running in tandem

In this example, you use Dynatrace Managed for some of your applications and Dynatrace SaaS for others and want your
MCP client to have context on where it can find data on each one.

```text
# Dynatrace

- I have two separate Dynatrace environments which both contain live data:
   1. Dynatrace Managed is self-hosted. It only contains observability data for only some of my systems,
      primarily the book store systems.
      It is accessed via the Dynatrace Managed MCP, named dynatrace-managed-mcp-server
   2. Dynatrace SaaS is used for observability of all my other systems.
      It is accessed through the Dynatrace SaaS MCP, named dynatrace-saas-mcp-server
- Be careful of which MCP to use.
  If it is unclear, ask which MCP to use.
- Must make it very clear to the user whether data has come from the Dynatrace Managed or Dynatrace SaaS environments.
```

## Example prompts

You can start with something as simple as "Ask Dynatrace to list problems", and follow up with more sophisticated [examples](examples).

## Troubleshooting

### Authentication Issues

In most cases, authentication issues are related to missing scopes or invalid tokens. Please ensure that you have added all required scopes as listed above.

When experiencing errors, you can ask the AI Assistant for the exact error returned by the MCP. For startup issues, you can look in the AI Assistant logs.

You can also try running the MCP directly to see if it reports errors on startup:

    ```bash
    npx @dynatrace-oss/dynatrace-managed-mcp-server@latest
    ```

## Telemetry

The Dynatrace MCP Server includes sending Telemetry Data via Dynatrace OpenKit to help improve the product. This includes:

- Server start events
- Tool usage (which tools are called, success/failure, execution duration)
- Error tracking for debugging and improvement

**Privacy and Opt-out:**

- Telemetry is **enabled by default** but can be disabled by setting `DT_MCP_DISABLE_TELEMETRY=true`
- No sensitive data from your Dynatrace environment is tracked
- Only anonymous usage statistics and error information are collected
- Usage statistics and error data are transmitted to Dynatrace’s analytics endpoint

**Configuration options:**

- `DT_MCP_DISABLE_TELEMETRY` (boolean, default: `false`) - Disable Telemetry
- `DT_MCP_TELEMETRY_APPLICATION_ID` (string, default: `dynatrace-managed-mcp`) - Application ID for tracking
- `DT_MCP_TELEMETRY_ENDPOINT_URL` (string, default: Dynatrace endpoint) - OpenKit endpoint URL
- `DT_MCP_TELEMETRY_DEVICE_ID` (string, default: auto-generated) - Device identifier for tracking

To disable usage tracking, add this to your environment:

```bash
DT_MCP_DISABLE_TELEMETRY=true
```
