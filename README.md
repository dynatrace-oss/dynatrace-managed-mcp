# Dynatrace Managed MCP Server

<h4>
  <a href="https://github.com/dynatrace-oss/dynatrace-managed-mcp/releases">
    <img src="https://img.shields.io/github/release/dynatrace-oss/dynatrace-managed-mcp?color=c05240" alt="Latest Dynatrace Managed MCP Server releases"/>
  </a>
  <a href="https://github.com/dynatrace-oss/dynatrace-managed-mcp/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-Apache_2.0-blue?color=7c38a1" alt="Dynatrace Managed MCP Server is released under the Apache 2.0 License" />
  </a>
  <a href="https://www.npmjs.com/package/@dynatrace-oss/dynatrace-managed-mcp-server">
    <img src="https://img.shields.io/npm/dm/@dynatrace-oss/dynatrace-managed-mcp-server?logo=npm&color=5ead35" alt="npm" />
  </a>
  <a href="https://github.com/dynatrace-oss/dynatrace-managed-mcp">
    <img src="https://img.shields.io/github/contributors/dynatrace-oss/dynatrace-managed-mcp?color=5ead35" alt="Dynatrace Managed MCP Server Contributors on GitHub" />
  </a>
  <a href="https://github.com/dynatrace-oss/dynatrace-managed-mcp">
    <img src="https://img.shields.io/github/stars/dynatrace-oss/dynatrace-managed-mcp" alt="Dynatrace Managed MCP Server Stars on GitHub" />
  </a>
</h4>

<details>
  <summary>Use cases</summary>

> 1. Your Dynatrace Managed environment(s) is/are the primary Observability system, containing all live data; or
> 2. There has been a migration from a Dynatrace Managed environment to a Dynatrace Saas environment; however, historical observability data has not been migrated and can still be accessed via a Dynatrace Managed environment.
>    The Dynatrace Managed MCP is used to access historical data, and a separate Dynatrace SaaS MCP is used to access live and more recent data.

> Specific use cases for the Dynatrace Managed MCP include:
>
> - **Real-time observability** - Fetch production-level data for early detection and proactive monitoring
> - **Contextual debugging** - Fix issues with full context from monitored exceptions, logs, and anomalies
> - **Security insights** - Get detailed vulnerability analysis and security problem tracking. This can include multicloud compliance assessment with evidence-based investigation.
> - **Natural language queries** - Queries are mapped to MCP tool usage, and thus API queries, with guidance for the next step
> - **Multiphase incident investigation** - Systematic impact assessment and troubleshooting
> - **Multienvironment support** - Query multiple Dynatrace Managed environments from the same MCP server

</details>

<details>
  <summary>Capabilities</summary>

> - **Problems** - List and get [problem](https://www.dynatrace.com/hub/detail/problems/) details from your services (for example Kubernetes)
> - **Security** - List and get security problems / [vulnerability](https://www.dynatrace.com/hub/detail/vulnerabilities/) details
> - **Entities** - Get more information about a monitored entity, including relationship mappings
> - **SLO** - List and get Service Level Objective details, including evaluation and error budgets
> - **Event Tracking** - List and get system events
> - **Log Investigation** - Search and filter logs with advanced content and time-based queries
> - **Metrics Analysis** - Query and analyze performance metrics using V2 Metrics API

</details>

The local _Dynatrace Managed MCP server_ allows AI Assistants to interact with one or more self-hosted [Dynatrace Managed](https://www.dynatrace.com/) deployments, bringing observability data directly into your AI-assisted workflow.

This MCP server supports **two modes**:

- **Local mode:** Runs on your machine for development and testing.
- **Remote mode:** Connects over HTTP/SSE for distributed or production-like setups.

> [!TIP]
> This MCP server is specifically designed for Dynatrace Managed (self-hosted) deployments.
> For Dynatrace SaaS environments, please use the [Dynatrace MCP](https://github.com/dynatrace-oss/dynatrace-mcp).

> [!NOTE]
> This open source product is supported by the community.
> For feature requests, questions, or assistance, please use [GitHub Issues](https://github.com/dynatrace-oss/dynatrace-managed-mcp/issues).

## Quickstart in stdio (local) mode

You can add this MCP server to your AI Assistant, such as VSCode, Claude, Cursor, Kiro, Windsurf, ChatGPT, or GitHub Copilot.

To run this MCP server to have to configure 3 things:

- _**Dynatrace Managed API token**_
- _**Configuration file**_: `dt-config.yaml` or `dt-config.json` file which is responsible for defining list of environments you intend to use
- _**MCP Server connection configuration file:**_ local mcp configuration, which is dependent on tools you are using

Files have to be created in the same workspace (unless configuring global MCP server connection)

### Dynatrace Managed API token

For information about creating API tokens in Managed deployments, refer to the [Dynatrace Managed documentation](https://docs.dynatrace.com/managed/shortlink/api-authentication#create-token).
Your API token must include the following scopes for full functionality:

- Access problem and event feed, metrics, and topology (`DataExport`)
- Read entities (`entities.read`)
- Read events (`events.read`)
- Read logs (`logs.read`)
- Read metrics (`metrics.read`)
- Read problems (`problems.read`)
- Read security problems (`securityProblems.read`)
- Read SLO (`slo.read`)

### Configuration File

#### Configuration parameters

| Parameter      | Required           | Description                                                                                    | Example value                                     |
| -------------- | ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| apiEndpointUrl | Yes                | Base URL for Dynatrace Managed cluster API                                                     | https://<span>dmz123.dynatrace-managed.com</span> |
| environmentId  | Yes                | ID of the managed environment                                                                  | 01234567-89ab-cdef-abcd-ef0123456789              |
| alias          | Yes                | Human-friendly name of the environment                                                         | MyEnvironment                                     |
| apiToken       | Only in stdio mode | API token of the cluster with required scopes created using the instruction above              | dt0s01.ABCDEFGHIJK0123                            |
| httpProxyUrl   | No                 | URL of proxy server for requests. Do not use with the other proxy parameter                    | http://<span>proxy.company.com:8080</span>        |
| httpsProxyUrl  | No                 | URL of proxy server for requests. Do not use with the other proxy parameter                    | https:/<span>/proxy.company.com:8080</span>       |
| dynatraceUrl   | No                 | Deprecated, currently prints itself in tool responses. Defaults to the value of apiEndpointUrl | https://<span>dmz123.dynatrace-managed.com</span> |

There are **two ways** to configure your Dynatrace Managed environments.

#### Method 1: Configuration File (Recommended for Local Development)

Example: `dt-config.yaml`

```yaml
# Production environment
- apiEndpointUrl: https://my-api.company.com/
  environmentId: abc-123
  alias: production
  # Token is injected from an environment variable at runtime
  apiToken: ${DT_PROD_TOKEN}
  # You can also use the token directly
  # apiToken: dt0s01.ABCDEFGHIJK0123

# Staging environment
- apiEndpointUrl: https://staging-api.company.com/
  environmentId: xyz-789
  alias: staging
  apiToken: ${DT_STAGING_TOKEN}
```

Example: `dt-config.json`

```json
[
  {
    "apiEndpointUrl": "https://my-api.company.com/",
    "environmentId": "abc-123",
    "alias": "production",
    "apiToken": "${DT_PROD_TOKEN}"
  }
]
```

#### Method 2: Environment Variable (Docker/Kubernetes)

For Kubernetes deployments or if you prefer environment variables, you can set `DT_ENVIRONMENT_CONFIGS` with a JSON string in either your `.env` file or directly in MCP Server connection configuration file

```shell
DT_ENVIRONMENT_CONFIGS='[{"apiEndpointUrl":"https://api.example.com/","environmentId":"abc-123","alias":"production","apiToken":"dt0s01.ABCDEFGHIJK0123"}]'
```

### MCP Server connection configuration file

To actually connect to the MCP server you have to configure your MCP connection in your AI Assistant

We recommend always setting it up for your current workspace instead of using it globally.

#### VS Code

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

Alternatively, this can also be stored in user settings, and you can define `env` as follows:

```json
{
  "servers": {
    "npx-dynatrace-managed-mcp": {
      "command": "npx",
      "args": ["-y", "@dynatrace-oss/dynatrace-managed-mcp-server@latest"],
      "env": {
        "DT_PROD_TOKEN": "dt0s01.ABCDEFGHIJK0123"
      }
    }
  }
}
```

#### Claude Desktop

```json
{
  "mcpServers": {
    "dynatrace-managed-mcp": {
      "command": "npx",
      "args": ["-y", "@dynatrace-oss/dynatrace-managed-mcp-server@latest"],
      "env": {
        "DT_PROD_TOKEN": "dt0s01.ABCDEFGHIJK0123"
      }
    }
  }
}
```

#### Kiro

```json
{
  "mcpServers": {
    "dynatrace-managed-mcp": {
      "command": "npx",
      "args": ["-y", "@dynatrace-oss/dynatrace-managed-mcp-server@latest"],
      "env": {
        "DT_PROD_TOKEN": "dt0s01.ABCDEFGHIJK0123"
      }
    }
  }
}
```

This configuration should be stored in `<project-root>/.kiro/settings/mcp.json`, or in user-level settings (`~/.kiro/settings/mcp.json`).

#### Google Gemini CLI

Using `gemini` CLI directly (recommended):

```bash
gemini extensions install https://github.com/dynatrace-oss/dynatrace-managed-mcp
export DT_ENVIRONMENT_CONFIGS="[{\"dynatraceUrl\":\"https://my-dashboard-endpoint.com/\",\"apiEndpointUrl\":\"https://my-api-endpoint.com/\",\"environmentId\":\"my-env-id-1\",\"alias\":\"alias-env\",\"apiToken\":\"my-api-token\"},{\"dynatraceUrl\":\"https://my-dashboard2-endpoint.com/\",\"apiEndpointUrl\":\"https://my-api2-endpoint.com/\",\"environmentId\":\"my-env-id-2\",\"alias\":\"alias-env-2\",\"apiToken\":\"my-api-token-2\"}]"
export DT_PROD_TOKEN="dt0s01.ABCDEFGHIJK0123"
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

## HTTP Server Mode (Alternative)

The default mode for this local MCP uses stdio for transport.

For scenarios where you need to run the MCP server as an HTTP service instead, you can use the HTTP server mode (e.g., for load balancing or integration with web clients):

### Running as HTTP server

Make sure you have the [Configuration File](#configuration-file) in the same folder. You do not have to define API tokens for configurations ran in HTTP mode.

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
```

> [!WARNING]
> In HTTP mode the server validates the `Host` header to protect against DNS rebinding attacks. With `--host 0.0.0.0` (or `--host ::`) only **loopback** hostnames are accepted by default, so remote clients receive `403 Forbidden` until you set `DT_MCP_ALLOWED_HOSTS` to the hostnames they use. See [DNS Rebinding Protection](#dns-rebinding-protection-http-mode).

#### MCP Server connection configuration file:

As explained earlier, HTTP mode does not store API tokens in its configuration. Authentication is done by the user by filling the `X-Dynatrace-Tokens` header.

```json
{
  "mcpServers": {
    "dynatrace-managed-mcp": {
      "url": "http://localhost:3000",
      "transport": "http",
      "headers": {
        "Content-Type": "application/json",
        "Accept": "application/json,text/event-stream",
        "X-Dynatrace-Tokens": "alias1=token1;alias2=token2"
      }
    }
  }
}
```

### Performance Considerations

**Important:** This MCP server makes API calls to the Dynatrace Managed environment(s). It is designed for efficient usage (e.g., limiting the response sizes), but care should be taken not to overload the Dynatrace Managed environment(s) with large queries.

**Best Practices:**

1. Use specific time ranges (e.g., 1-2 hours) rather than large historical queries.
2. Use specific filters to limit the scope of queries as much as possible, for example, entity selectors that specify the entity ID.
3. If using multiple environments, be specific about which one to query, where applicable. If querying multiple at once, be mindful of how much data will be returned to the LLM, e.g. top 10 problems from 2 envs = 20 problems, versus top 10 problems from 10 envs = 100 problems.

### DNS Rebinding Protection (HTTP mode)

- **`DT_MCP_ALLOWED_HOSTS`** (optional): Comma-separated list of hostnames the server accepts in the `Host` header. Ports are ignored, so list hostnames only (use the bracketed form for IPv6, e.g. `[::1]`).

When this variable is **not** set, the allowlist is derived from `--host`: the bound address plus `localhost`, `127.0.0.1` and `[::1]`. Requests whose `Host` header is not on the list are rejected with `403 Forbidden`, as are requests carrying an `Origin` header for a hostname that is not on the list. This is what prevents [DNS rebinding attacks](https://en.wikipedia.org/wiki/DNS_rebinding).

Validation is always active: there is no configuration in which it is silently skipped.

> [!IMPORTANT]
> When bound to a wildcard address (`--host 0.0.0.0` or `--host ::`), the bound address does not identify which hostnames are legitimate, so the server **accepts loopback hostnames only** and logs a warning at startup. DNS rebinding is blocked in this mode, but so is every remote client. If you run in a container or expose the server on a network, you **must** set `DT_MCP_ALLOWED_HOSTS` to the hostnames your clients use, or they will receive `403 Forbidden`.

**Example:** container bound to all interfaces, reached as `mcp.internal.example.com`:

```bash
DT_MCP_ALLOWED_HOSTS=mcp.internal.example.com node dist/index.js --http --host 0.0.0.0
```

`DT_MCP_ALLOWED_HOSTS` **replaces** the derived list rather than extending it, so include loopback names explicitly if you also need local access:

```bash
DT_MCP_ALLOWED_HOSTS=mcp.internal.example.com,localhost,127.0.0.1
```

## Troubleshooting

### Authentication Issues

In most cases, authentication issues stem from missing scopes or invalid tokens. Please ensure that you have added all required scopes as listed above.

When experiencing errors, you can ask the AI Assistant for the exact error returned by the MCP. For startup issues, check the AI Assistant logs.

You can also try running the MCP directly to see if it reports errors on startup:

    ```bash
    npx @dynatrace-oss/dynatrace-managed-mcp-server@latest
    ```

### Header size limits is too small

The `X-Dynatrace-Tokens` header grows with the number of environments. Each entry is roughly
`alias=dt0s01.ABCDEFGHIJK0123` (~110 characters). Node.js enforces a default HTTP header size limit of
**16 KB**, which accommodates approximately 140–150 environments before requests are rejected.

If you need more environments, increase the limit at server startup with the `--max-http-header-size`
flag:

```bash
node --max-http-header-size=65536 ./dist/index.js --http
```

If you are running a **reverse proxy** (such as nginx) in front of the MCP server, the proxy also
enforces its own limit. nginx defaults to 8 KB (`large_client_header_buffers`), which fits roughly
70 environments. Raise it in your nginx configuration:

```nginx
large_client_header_buffers 4 32k;
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
- Usage statistics and error data is transmitted to Dynatrace’s analytics endpoint

**Configuration options:**

- `DT_MCP_DISABLE_TELEMETRY` (boolean, default: `false`) - Disable Telemetry
- `DT_MCP_TELEMETRY_APPLICATION_ID` (string, default: `dynatrace-managed-mcp`) - Application ID for tracking
- `DT_MCP_TELEMETRY_ENDPOINT_URL` (string, default: Dynatrace endpoint) - OpenKit endpoint URL
- `DT_MCP_TELEMETRY_DEVICE_ID` (string, default: auto-generated) - Device identifier for tracking

To disable usage tracking, add this to your configuration:

```bash
DT_MCP_DISABLE_TELEMETRY=true
```

## Additional documentation

### MCP Server usage

- [API token scopes](docs/api_token_scopes.md) - table containing information about available tools, endpoints they are calling and required API token scopes to properly access them
- [Architecture](docs/architecture.md) - detailed diagrams representing architecture of Dynatrace environment while using MCP server in either stdio or http mode
- [Environment variables](docs/environment_variables.md) - detailed information about available environment variables
- [Rule file](docs/rule_file.md) - determine rules for your AI Assistant to ensure smooth usage of the Managed cluster

### Development

- [Changelog format](docs/CHANGELOG.format.md) - instruction for developers on how to write consistent and structured changelogs
- [Development](docs/DEVELOPMENT.md) - general information about running the project and its contents
