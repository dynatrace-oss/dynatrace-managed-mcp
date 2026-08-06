# Configuration reference

Every environment variable and configuration-file field the server reads, with defaults, precedence and known pitfalls. For step-by-step setup see [local mode](setup-local.md) or [remote mode](setup-remote.md).

## Configuration file

The recommended way to configure one or more Dynatrace Managed environments is a YAML or JSON file, referenced by `DT_CONFIG_FILE`.

- **Relative paths** are resolved against the working directory of the process that starts the server — in practice, that's the AI client (Claude Desktop, VS Code, etc.), not this repository. Prefer an absolute path or a `~` path so the file resolves the same way regardless of how the client launches the server.
- **Absolute paths** are used as-is.
- **`~` expansion**: a leading `~` is expanded by the server itself, checking `HOME` then `USERPROFILE` — it does not rely on the shell having expanded it first.
- **`${VAR_NAME}` interpolation**: any `${VAR_NAME}` in the file's content is substituted from the process environment before the file is parsed, so tokens can be kept out of the file itself.

By convention, the file lives at `~/.dynatrace/managed-mcp.yaml`.

```yaml
# Production environment
- alias: production
  apiEndpointUrl: https://my-api.company.com/
  environmentId: abc-123
  dynatraceUrl: https://my-dashboard.company.com/
  apiToken: dt0c01.ABC123...
  httpProxyUrl: http://proxy.company.com:8080

# Staging environment
- alias: staging
  apiEndpointUrl: https://staging-api.company.com/
  environmentId: xyz-789
  apiToken: dt0c01.XYZ789...
```

To commit this file without embedding tokens, interpolate them from the environment instead:

```yaml
- alias: production
  apiEndpointUrl: https://my-api.company.com/
  environmentId: abc-123
  apiToken: ${DT_PROD_TOKEN}

- alias: staging
  apiEndpointUrl: https://staging-api.company.com/
  environmentId: xyz-789
  apiToken: ${DT_STAGING_TOKEN}
```

`DT_PROD_TOKEN` and `DT_STAGING_TOKEN` are ordinary environment variables you name yourself and set before starting the server — the server never reads them directly, it only substitutes them into the file content.

The same structure as JSON:

```json
[
  {
    "alias": "production",
    "apiEndpointUrl": "https://my-api.company.com/",
    "environmentId": "abc-123",
    "apiToken": "dt0c01.ABC123..."
  }
]
```

Full examples: [`../examples/dt-config.yaml`](../examples/dt-config.yaml) and [`../examples/dt-config.json`](../examples/dt-config.json) (local/stdio mode, tokens interpolated), and [`../examples/dt-config-http.yaml`](../examples/dt-config-http.yaml) (HTTP mode — no tokens in the file at all).

## Configuration fields

One table for every field, however you supply it — config file or `DT_ENVIRONMENT_CONFIGS`:

| Field            | Required                                            | Notes                                                                                                             |
| ---------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `apiEndpointUrl` | yes                                                 | Base URL for the Managed API; the environment ID is appended. Example `https://abc123.dynatrace-managed.com:9999` |
| `environmentId`  | yes                                                 | e.g. `01234567-89ab-cdef-abcd-ef0123456789`                                                                       |
| `apiToken`       | yes in local mode, **must be omitted in HTTP mode** | See [required scopes](api-token.md#required-scopes)                                                               |
| `alias`          | yes                                                 | Human-readable name; how you refer to the environment when talking to the assistant                               |
| `dynatraceUrl`   | no                                                  | Base URL for the dashboard. If omitted, falls back to the `apiEndpointUrl` field of the same entry                |
| `httpProxyUrl`   | no                                                  | Per-environment HTTP proxy — see [Proxy](#proxy)                                                                  |
| `httpsProxyUrl`  | no                                                  | Per-environment HTTPS proxy — see [Proxy](#proxy)                                                                 |

## Environment variables

| Variable                          | Category       | Default                     | Notes                                                                                                                 |
| --------------------------------- | -------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `DT_CONFIG_FILE`                  | Configuration  | none                        | Path to the config file. See [Configuration file](#configuration-file).                                               |
| `DT_ENVIRONMENT_CONFIGS`          | Configuration  | none                        | JSON-array string, used only when `DT_CONFIG_FILE` is unset. See [`DT_ENVIRONMENT_CONFIGS`](#dt_environment_configs). |
| `LOG_LEVEL`                       | Logging        | `info`                      | Log verbosity. See [Logging](#logging).                                                                               |
| `LOG_OUTPUT`                      | Logging        | `file`                      | Log destination. See [Logging](#logging) for the full transport matrix.                                               |
| `LOG_FILE`                        | Logging        | `dynatrace-managed-mcp.log` | Log file path, used when `LOG_OUTPUT` includes `file`.                                                                |
| `DT_MCP_RATE_LIMIT_MAX_CALLS`     | Rate limiting  | `20`                        | Max tool calls per window, per caller. See [Rate limiting](#rate-limiting).                                           |
| `DT_MCP_RATE_LIMIT_WINDOW_MS`     | Rate limiting  | `20000`                     | Rate-limit window size, in milliseconds.                                                                              |
| `DT_MCP_MAX_BODY_SIZE`            | HTTP transport | `1048576`                   | Maximum accepted POST body size in bytes, HTTP mode only. Larger requests get `413 Request Entity Too Large`.         |
| `DT_MCP_TOKEN_VALIDATION_TTL_MS`  | HTTP transport | `60000`                     | How long a validated token is cached, HTTP mode only. `0` disables caching.                                           |
| `DT_MCP_DISABLE_TELEMETRY`        | Telemetry      | `false`                     | Set to `true` to disable telemetry. See [Telemetry](#telemetry).                                                      |
| `DT_MCP_TELEMETRY_APPLICATION_ID` | Telemetry      | Dynatrace-owned default     | Overrides the OpenKit application ID.                                                                                 |
| `DT_MCP_TELEMETRY_ENDPOINT_URL`   | Telemetry      | Dynatrace-owned default     | Overrides the OpenKit beacon endpoint the data is sent to.                                                            |
| `DT_MCP_TELEMETRY_DEVICE_ID`      | Telemetry      | auto-generated              | Overrides the per-install device identifier.                                                                          |

## Configuration precedence

1. `DT_CONFIG_FILE` — used if set, regardless of anything else.
2. `DT_ENVIRONMENT_CONFIGS` — used only if `DT_CONFIG_FILE` is unset.
3. Neither set — the server exits with an error describing both options.

Setting both is allowed but discouraged: the server logs a warning and uses `DT_CONFIG_FILE`, silently ignoring `DT_ENVIRONMENT_CONFIGS`.

## `DT_ENVIRONMENT_CONFIGS`

For Kubernetes ConfigMaps/Secrets, Docker containers and CI/CD pipelines, set `DT_ENVIRONMENT_CONFIGS` to a JSON array of environment objects as a single string, instead of pointing at a file:

```bash
DT_ENVIRONMENT_CONFIGS='[{"apiEndpointUrl":"https://api.example.com/","environmentId":"abc-123","alias":"production","apiToken":"dt0c01.ABC123"}]'
```

The fields are the same as [Configuration fields](#configuration-fields). Quote escaping makes this awkward for local, interactive use — prefer [the config file](#configuration-file) there; this method suits Kubernetes, Docker and CI better than local development.

A `.env` file can hold `DT_ENVIRONMENT_CONFIGS` too, but multiline values don't survive reliably in `.env` files — use the config file for anything beyond a short, single-line value.

## Logging

- `LOG_LEVEL` — log verbosity: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. Default `info`.
- `LOG_OUTPUT` — log destination:

  | Value                          | Behavior                                              |
  | ------------------------------ | ----------------------------------------------------- |
  | `file` (default)               | Write logs to `LOG_FILE`.                             |
  | `stdout` / `console`           | Write all logs to stdout.                             |
  | `stderr`                       | Write only `error`/`warn` to stderr.                  |
  | `stderr-all`                   | Write all log levels to stderr.                       |
  | `file+console` / `file+stdout` | Write to both the log file and stdout.                |
  | `file+stderr`                  | Write to the log file, plus `error`/`warn` to stderr. |
  | `disabled`                     | Disable logging entirely.                             |

- `LOG_FILE` — path to the log file, used whenever `LOG_OUTPUT` includes `file`. Default `dynatrace-managed-mcp.log` in the current working directory.

> [!IMPORTANT]
> In stdio mode, stdout is the MCP protocol channel — anything else written there corrupts it. Use `stderr-all` or `file`; the stdout-writing values above (`stdout`, `console`, `file+console`, `file+stdout`) only make sense with `--http`. If `LOG_OUTPUT` is set to one of them while running stdio, the server prints a startup warning.

```bash
# stdio: see everything in the client's Output/log panel
LOG_OUTPUT=stderr-all LOG_LEVEL=debug

# stdio: write to a file, then tail it
LOG_LEVEL=debug
tail -f dynatrace-managed-mcp.log

# HTTP: log to console
LOG_OUTPUT=console LOG_LEVEL=debug node dist/index.js --http
```

## Rate limiting

- `DT_MCP_RATE_LIMIT_MAX_CALLS` — maximum tool calls allowed per window. Default `20`.
- `DT_MCP_RATE_LIMIT_WINDOW_MS` — window size in milliseconds. Default `20000` (20 seconds).

```bash
DT_MCP_RATE_LIMIT_MAX_CALLS=50
DT_MCP_RATE_LIMIT_WINDOW_MS=30000
```

The limiter buckets **per caller**: in HTTP mode the bucket key is derived from the token(s) supplied in the request's token header, so each user gets an independent bucket; in stdio mode there is a single, constant key, so the limit applies to that one connection as a whole. When sizing this for a shared HTTP deployment, remember the limit is per user, not a total budget for the server.

## Proxy

Proxies are configured **per environment**, with the `httpProxyUrl` / `httpsProxyUrl` [config fields](#configuration-fields). This is the only mechanism the server supports.

> [!WARNING]
> The standard `HTTP_PROXY` and `HTTPS_PROXY` environment variables are **not** read by this server. Setting them has no effect on outbound requests.
>
> Set at most one of `httpProxyUrl` / `httpsProxyUrl` per environment. Setting **both** on the same environment logs an error and disables the proxy for that environment entirely — neither proxy is used.

```yaml
- alias: production
  apiEndpointUrl: https://prod-api.company.com/
  environmentId: abc-123
  apiToken: ${DT_PROD_TOKEN}
  httpProxyUrl: http://proxy.company.com:8080

- alias: staging
  apiEndpointUrl: https://staging-api.company.com/
  environmentId: xyz-789
  apiToken: ${DT_STAGING_TOKEN}
```

`production` routes through the proxy; `staging` does not — `httpProxyUrl`/`httpsProxyUrl` apply only to the entry they're set on.

## Telemetry

The server sends anonymous usage telemetry to Dynatrace via OpenKit: server-start events, tool usage (which tools, success/failure, duration), and error tracking. No data from your Dynatrace Managed environment — entities, logs, metrics, tokens — is included; only information about how the MCP server itself is used.

- `DT_MCP_DISABLE_TELEMETRY` — set to `true` to disable telemetry entirely. Default `false` (enabled).
- `DT_MCP_TELEMETRY_APPLICATION_ID` — overrides the OpenKit application ID. Default: a fixed ID owned by Dynatrace.
- `DT_MCP_TELEMETRY_ENDPOINT_URL` — overrides the OpenKit beacon endpoint the data is sent to. Default: Dynatrace's analytics endpoint.
- `DT_MCP_TELEMETRY_DEVICE_ID` — overrides the per-install device identifier. Default: auto-generated from the hostname and random bytes at startup.

```bash
DT_MCP_DISABLE_TELEMETRY=true
```
