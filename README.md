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

The local _Dynatrace Managed MCP server_ allows AI Assistants to interact with one or more self-hosted [Dynatrace Managed](https://www.dynatrace.com/) deployments,
bringing observability data directly into your AI assisted workflow.

This MCP server supports **two modes**:

- **Local mode:** Runs on your machine for development and testing.
- **Remote mode:** Connects over HTTP/SSE for distributed or production-like setups.

> [!TIP]
> This MCP server is specifically designed for Dynatrace Managed (self-hosted) deployments.
> For Dynatrace SaaS environments, please use the [Dynatrace MCP](https://github.com/dynatrace-oss/dynatrace-mcp).

> [!WARNING]
> This product is not officially supported by Dynatrace.

If you need help, please contact us via [GitHub Issues](https://github.com/dynatrace-oss/dynatrace-managed-mcp/issues) if you have feature requests, questions, or need help.

## Quickstart

You can add this MCP server to your AI Assistant such as VSCode, Claude, Cursor, Kiro, Windsurf, ChatGPT, or Github Copilot.
For more details, please refer to the [configuration section below](#configuration).

You need to configure the connection to your Dynatrace Managed environment(s). There is one variable to set (`DT_ENVIRONMENT_CONFIGS`)
which contains escaped JSON that defines all of your managed deployments. These are held in an array, with one element per environment.

```json
[
  {
    "dynatraceUrl": "https://my-dashboard-endpoint.com/",
    "apiEndpointUrl": "https://my-api-endpoint.com/",
    "environmentId": "my-env-id-1",
    "alias": "alias-env",
    "apiToken": "my-api-token",
    "httpProxyUrl": "",
    "httpsProxyUrl": ""
  },
  {
    "dynatraceUrl": "https://my-dashboard2-endpoint.com/",
    "apiEndpointUrl": "https://my-api2-endpoint.com/",
    "environmentId": "my-env-id-2",
    "alias": "alias-env-2",
    "apiToken": "my-api-token-2",
    "httpProxyUrl": "",
    "httpsProxyUrl": ""
  }
]
```

where:

- `dynatraceUrl`: base url for Dynatrace Managed dashboard, to which the environment id will be appended (e.g. `https://dmz123.dynatrace-managed.com`).
  If not specified, will default to use the same value as `DT_API_ENDPOINT_URL`.
- `apiEndpointUrl`: base url for Dynatrace Managed API, to which the environment id will be appended (e.g. `https://abc123.dynatrace-managed.com:9999`)
- `environmentId`: id of the managed environment, used for constructing URL for API and dashboards (e.g. of the form `01234567-89ab-cdef-abcd-ef0123456789`)
- `alias`: a friendly/human-readable name for the environment
- `apiToken`: API token with required scopes (see [Authentication](#authentication))
- (optional) `httpProxyUrl`/`httpsProxyUrl`: URL of proxy server for requests (see [Environment Variables](#environment-variables))

This needs to be escaped and set as the `DT_ENVIRONMENT_CONFIGS` environment variable, e.g.:

```shell
DT_ENVIRONMENT_CONFIGS='[
    {
        "dynatraceUrl": "https://my-dashboard-endpoint.com/",
        "apiEndpointUrl": "https://my-api-endpoint.com/",
        "environmentId": "my-env-id-1",
        "alias": "alias-env",
        "apiToken": "my-api-token",
        "httpProxyUrl": "http://proxy.company.com:8080"
    },
    {
        "dynatraceUrl": "https://my-dashboard2-endpoint.com/",
        "apiEndpointUrl": "https://my-api2-endpoint.com/",
        "environmentId": "my-env-id-2",
        "alias": "alias-env-2",
        "apiToken": "my-api-token-2",
        "httpProxyUrl": "http://proxy.company.com:8080"
    }
]'
```

If you are using multiple environments, we strongly recommend you set up rules (see [Rules](#rule-file)) to steer your LLM to better
understand each of your environments.

Changes to environment configuration will need from an MCP server restart/reload. Changes won't be picked up until a fresh reload.

Once configured, you can start using [example prompts](#Example-Prompts) like `Get all details of the Dynatrace entity 'my-service'`
or `What problems has Dynatrace identified? Give details of the first problem.`.

These queries use V2 REST APIs and do not incur additional costs beyond your standard Managed license.

Minimum supported version: Dynatrace Managed 1.328.0

## Architecture

### Local mode

![Architecture (local mode)](./assets/dynatrace-managed-mcp-arch-local.png?raw=true)

### Remote mode

![Architecture (remote mode)](./assets/dynatrace-managed-mcp-arch-remote.png?raw=true)

## Use cases

There are two ways that Dynatrace Managed, and thus the MCP, may be used:

1. Your Dynatrace Managed environment(s) is/are the primary Observability system, containing all live data; or
2. There has been a migration from a Dynatrace Managed environment to a Dynatrace Saas environment, however historical observability data has not been migrated and can still be access via a Dynatrace Managed environment.
   The Dynatrace Managed MCP is used to access historical data, and a separate Dynatrace SaaS MCP is used to access live and more recent data.

Specific use cases for the Dynatrace Managed MCP include:

- **Real-time observability** - Fetch production-level data for early detection and proactive monitoring
- **Contextual debugging** - Fix issues with full context from monitored exceptions, logs, and anomalies
- **Security insights** - Get detailed vulnerability analysis and security problem tracking. This can include multi-cloud compliance assessment with evidence-based investigation.
- **Natural language queries** - Queries are mapped to MCP tool usage, and thus API queries, with guidance for next step
- **Multiphase incident investigation** - Systematic impact assessment and troubleshooting
- **Multienvironment support** - Query multiple Dynatrace Managed environments from the same MCP server

## Capabilities

- **Problems** - List and get [problem](https://www.dynatrace.com/hub/detail/problems/) details from your services (for example Kubernetes)
- **Security** - List and get security problems / [vulnerability](https://www.dynatrace.com/hub/detail/vulnerabilities/) details
- **Entities** - Get more information about a monitored entity, including relationship mappings
- **SLO** - List and get Service Level Objective details, including evaluation and error budgets
- **Event Tracking** - List and get system events
- **Log Investigation** - Search and filter logs with advanced content and time-based queries
- **Metrics Analysis** - Query and analyze performance metrics using V2 Metrics API

### Performance Considerations

**Important:** This MCP server is makes API calls to the Dynatrace Managed environment(s). It is designed for efficient usage (e.g. limiting the response sizes),
but care should be taken to not overload the Dynatrace Managed environment(s) with large queries.

**Best Practices:**

1. Use specific time ranges (e.g., 1-2 hours) rather than large historical queries.
2. Use specific filters to limit the scope of queries as much as possible, for example entity selectors that specify the entity id.
3. If using multiple environments, be specific on which one to query where applicable. If querying multiple at once, be mindful of how much data will be returned to the LLM, e.g. top 10 problems from 2 envs = 20 problems, versus top 10 problems from 10 envs = 100 problems.

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
        "DT_ENVIRONMENT_CONFIGS": "[{\"dynatraceUrl\":\"https://my-dashboard-endpoint.com/\",\"apiEndpointUrl\":\"https://my-api-endpoint.com/\",\"environmentId\":\"my-env-id-1\",\"alias\":\"alias-env\",\"apiToken\":\"my-api-token\"},{\"dynatraceUrl\":\"https://my-dashboard2-endpoint.com/\",\"apiEndpointUrl\":\"https://my-api2-endpoint.com/\",\"environmentId\":\"my-env-id-2\",\"alias\":\"alias-env-2\",\"apiToken\":\"my-api-token-2\"}]"
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
        "DT_ENVIRONMENT_CONFIGS": "[{\"dynatraceUrl\":\"https://my-dashboard-endpoint.com/\",\"apiEndpointUrl\":\"https://my-api-endpoint.com/\",\"environmentId\":\"my-env-id-1\",\"alias\":\"alias-env\",\"apiToken\":\"my-api-token\"},{\"dynatraceUrl\":\"https://my-dashboard2-endpoint.com/\",\"apiEndpointUrl\":\"https://my-api2-endpoint.com/\",\"environmentId\":\"my-env-id-2\",\"alias\":\"alias-env-2\",\"apiToken\":\"my-api-token-2\"}]"
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
        "DT_ENVIRONMENT_CONFIGS": "[{\"dynatraceUrl\":\"https://my-dashboard-endpoint.com/\",\"apiEndpointUrl\":\"https://my-api-endpoint.com/\",\"environmentId\":\"my-env-id-1\",\"alias\":\"alias-env\",\"apiToken\":\"my-api-token\"},{\"dynatraceUrl\":\"https://my-dashboard2-endpoint.com/\",\"apiEndpointUrl\":\"https://my-api2-endpoint.com/\",\"environmentId\":\"my-env-id-2\",\"alias\":\"alias-env-2\",\"apiToken\":\"my-api-token-2\"}]"
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
export DT_ENVIRONMENT_CONFIGS="[{\"dynatraceUrl\":\"https://my-dashboard-endpoint.com/\",\"apiEndpointUrl\":\"https://my-api-endpoint.com/\",\"environmentId\":\"my-env-id-1\",\"alias\":\"alias-env\",\"apiToken\":\"my-api-token\"},{\"dynatraceUrl\":\"https://my-dashboard2-endpoint.com/\",\"apiEndpointUrl\":\"https://my-api2-endpoint.com/\",\"environmentId\":\"my-env-id-2\",\"alias\":\"alias-env-2\",\"apiToken\":\"my-api-token-2\"}]"
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
        "DT_ENVIRONMENT_CONFIGS": "[{\"dynatraceUrl\":\"https://my-dashboard-endpoint.com/\",\"apiEndpointUrl\":\"https://my-api-endpoint.com/\",\"environmentId\":\"my-env-id-1\",\"alias\":\"alias-env\",\"apiToken\":\"my-api-token\"},{\"dynatraceUrl\":\"https://my-dashboard2-endpoint.com/\",\"apiEndpointUrl\":\"https://my-api2-endpoint.com/\",\"environmentId\":\"my-env-id-2\",\"alias\":\"alias-env-2\",\"apiToken\":\"my-api-token-2\"}]"
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

- `DT_ENVIRONMENT_CONFIGS`: An escaped JSON array that defines the Dynatrace Managed environment(s) to connect to. See below for contents of this.
- `LOG_LEVEL` (optional): Log verbosity level (e.g. debug, info, warn, error). Default: `info`
- `LOG_OUTPUT` (optional): Log output destination. Options:
  - `file` (default): Write logs to a file
  - `stdout`: Write logs to standard output
  - `console`: Alias for `stdout`
  - `stderr`: Write errors and warnings to standard error (info/debug still suppressed)
  - `stderr-all`: Write all log levels to standard error
  - `file+console` or `file+stdout`: Write logs to both file and stdout
  - `file+stderr`: Write logs to file and errors/warnings to stderr
  - `disabled`: Disable logging entirely
- `LOG_FILE` (optional): Path to log file when `LOG_OUTPUT` includes `file`. Default: `dynatrace-managed-mcp.log` in current working directory

**Logging Examples:**

```bash
# Log to standard output (useful for Docker/containerized environments)
LOG_OUTPUT=stdout node dist/index.js

# Log errors/warnings to stderr, suppress info/debug (standard Unix practice)
LOG_OUTPUT=stderr node dist/index.js

# Log to custom file path
LOG_OUTPUT=file LOG_FILE=/var/log/dynatrace-mcp.log node dist/index.js

# Log to both file and console (useful for debugging)
LOG_OUTPUT=file+console LOG_LEVEL=debug node dist/index.js

# Log to file, send errors/warnings to stderr (production use)
LOG_OUTPUT=file+stderr LOG_FILE=/var/log/app.log node dist/index.js

# Disable logging entirely (not recommended)
LOG_OUTPUT=disabled node dist/index.js
```

### Multienvironment Config Fields

Inside the `DT_ENVIRONMENT_CONFIGS` variable, the elements of the array must contain all of these fields for each environment:

- `dynatraceUrl`: base url for Dynatrace Managed dashboard, to which the environment id will be appended (e.g. `https://dmz123.dynatrace-managed.com`).
  If not specified, will default to use the same value as `DT_API_ENDPOINT_URL`.
- `apiEndpointUrl` (required): base url for Dynatrace Managed API, to which the environment id will be appended (e.g. `https://abc123.dynatrace-managed.com:9999`)
- `environmentId` (required): id of the managed environment, used for constructing URL for API and dashboards (e.g. of the form `01234567-89ab-cdef-abcd-ef0123456789`)
- `alias`: a friendly/human-readable name for the environment, useful when distinguishing between environments with the LLM
- `apiToken` (required): API token with required scopes (see [Authentication](#authentication))
- `httpProxyUrl` (optional): HTTP Proxy for corporate environments, to route traffic through (e.g. http://proxy.company.com:8080)
- `httpsProxyUrl` (optional): HTTPS Proxy for corporate environments, to route traffic through (e.g. https://proxy.company.com:8080)

**Proxy Configuration**

The MCP server honors system proxy settings for corporate environments for each Dynatrace Managed environment you configure:

- `httpProxyUrl` (optional, string, e.g., `http://proxy.company.com:8080`) - Proxy server URL for HTTPS requests; or
- `httpsProxyUrl` (optional, string, e.g., `http://proxy.company.com:8080`) - Proxy server URL for HTTP requests

Example configuration with proxy:

```bash
export DT_ENVIRONMENT_CONFIGS='[
    {
        "dynatraceUrl": "https://my-dashboard-endpoint.com/",
        "apiEndpointUrl": "https://my-api-endpoint.com/",
        "environmentId": "my-env-id-1",
        "alias": "alias-env",
        "apiToken": "my-api-token",
        "httpProxyUrl": "http://proxy.company.com:8080"
    },
    {
        "dynatraceUrl": "https://my-dashboard2-endpoint.com/",
        "apiEndpointUrl": "https://my-api2-endpoint.com/",
        "environmentId": "my-env-id-2",
        "alias": "alias-env-2",
        "apiToken": "my-api-token-2",
        "httpProxyUrl": "http://proxy.company.com:8080"
    }
]'
```

Note that the `httpProxyUrl`/`httpsProxyUrl` variables exist on a per-environment basis, so you can configure one environment to use a proxy
whilst others may not need it.

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

If you are using this MCP server in a hybrid setup alongside the SaaS MCP server and/or you have multiple managed environments, it is
recommended to add this to your configuration to prevent the AI Assistant from using the wrong MCP or getting confused.

Your steering rules will be unique to your setup, but some recommended templates are included below for you to use as a starter.
You can edit these as you see fit and include additional context that is specific to your environments.

#### Multiple Managed Environments

In this example, you have multiple Dynatrace Managed environments set up. This might be
a development/test/production setup, or different applications entirely. It is recommended to refer to your environments by the
same alias you used in the `DT_ENVIRONMENT_CONFIGS` `alias` field to prevent confusion.

```text
# Dynatrace

- I have three separate Dynatrace environments:
   1. "production" is a self-hosted Dynatrace Managed environment. It contains data about my production environment, and
      its issues and problems should outrank any other environment as this is customer facing.
      It is accessed via the Dynatrace Managed MCP, named
      dynatrace-managed-mcp-server.
   2. "test" is a self-hosted Dynatrace Managed environment. It contains data about my test environment, which is used to
      prepare code before going to Production.
      It is accessed via the Dynatrace Managed MCP, named dynatrace-managed-mcp-server.
   3. "development" is a self-hosted Dynatrace Managed environment. It contains data about my development environment,
      which is my lowest priority environment.
      It is accessed via the Dynatrace Managed MCP, named dynatrace-managed-mcp-server
- Be careful of which environment to use.
  If it is unclear, ask which environment to use.
- Must make it very clear to the user which environment data has come from.

```

#### Hybrid setup with migration date

In this example, you have migrated from Managed to SaaS, but still have historic data in your self-hosted Managed environment.
You want your AI Assistant to have context on what data lives where. This will enable it to know which environments to target
for the date range you ask for, e.g. `Show me all Dynatrace problems from the last 7 days` may require data from both environments
(and thus use both MCP servers), or may all reside in just the Dynatrace SaaS.

```text
# Dynatrace

- I have two separate Dynatraces:
   1. Dynatrace Managed is self-hosted. It contains only historical data from before 29th November 2025.
      It is accessed via the Dynatrace Managed MCP, named dynatrace-managed-mcp-server
   2. Dynatrace SaaS is used for all live data.
      It is accessed through the Dynatrace SaaS MCP, named dynatrace-saas-mcp-server
- Be careful of which MCP to use.
  If it is unclear, ask which MCP to use.
- Must make it very clear to the user whether data has come from the Dynatrace Managed or Dynatrace SaaS.
```

#### Hybrid setup running in tandem

In this example, you use Dynatrace Managed for some of your applications and Dynatrace SaaS for others and want your
MCP client to have context on where it can find data on each one.

```text
# Dynatrace

- I have two separate Dynatraces which both contain live data:
   1. Dynatrace Managed is self-hosted. It only contains observability data for only some of my systems,
      primarily the book store systems.
      It is accessed via the Dynatrace Managed MCP, named dynatrace-managed-mcp-server
   2. Dynatrace SaaS is used for observability of all my other systems.
      It is accessed through the Dynatrace SaaS MCP, named dynatrace-saas-mcp-server
- Be careful of which MCP to use.
  If it is unclear, ask which MCP to use.
- Must make it very clear to the user whether data has come from the Dynatrace Managed or Dynatrace SaaS.
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

To disable usage tracking, add this to your configuration:

```bash
DT_MCP_DISABLE_TELEMETRY=true
```
