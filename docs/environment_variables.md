# Environment Variables

## Configuration Variables

- **`DT_CONFIG_FILE`** (optional): Path to configuration file (JSON or YAML). **Recommended for local development.**
  - Supports relative paths (e.g., `./dt-config.yaml`)
  - Supports absolute paths (e.g., `/etc/dynatrace/config.yaml`)
  - Supports `~` expansion (e.g., `~/dt-config.yaml`)
  - Supports environment variable interpolation in file content (`${VAR_NAME}`)
  - Example: `DT_CONFIG_FILE=./dt-config.yaml`

- **`DT_ENVIRONMENT_CONFIGS`** (optional): JSON string with environment configurations. **Useful for Kubernetes/Docker.**
  - Used if `DT_CONFIG_FILE` is not set
  - Must be a valid JSON array
  - Example: `DT_ENVIRONMENT_CONFIGS='[{"apiEndpointUrl":"...","environmentId":"...","alias":"...","apiToken":"..."}]'`

> **Note:** If both `DT_CONFIG_FILE` and `DT_ENVIRONMENT_CONFIGS` are set, `DT_CONFIG_FILE` takes priority.

## Logging Variables

- `LOG_LEVEL` (optional): Log verbosity level (e.g. debug, info, warn, error). Default: `info`
- `LOG_OUTPUT` (optional): Log output destination. Default: `file`
  - `file`: Write logs to a file (default behavior)
  - `stdout` / `console`: Write logs to standard output (⚠️ **stdio transport only**: stdio is reserved for MCP protocol - use `stderr-all` instead)
  - `stderr`: Write errors and warnings to standard error (info/debug suppressed)
  - `stderr-all`: Write all log levels to standard error (✅ **Recommended for VS Code with stdio transport**)
  - `file+console` / `file+stdout`: Write logs to both file and stdout (⚠️ **stdio transport only**: stdio is reserved for MCP protocol - use `stderr-all` instead)
  - `file+stderr`: Write logs to file and errors/warnings to stderr
  - `disabled`: Disable logging entirely
- `LOG_FILE` (optional): Path to log file when `LOG_OUTPUT` includes `file`. Default: `dynatrace-managed-mcp.log` in current working directory

> [!IMPORTANT]
> **Choosing the right LOG_OUTPUT for your setup:**
>
> - **stdio transport (default)**: Use `LOG_OUTPUT=stderr-all` or `LOG_OUTPUT=file` (default)
>   - ❌ `LOG_OUTPUT=console` won't work - stdout is reserved for MCP protocol
>   - ✅ `LOG_OUTPUT=stderr-all` shows all logs in VS Code's Output panel
>   - ✅ `LOG_OUTPUT=file` writes to log file (read with `tail -f dynatrace-managed-mcp.log`)
> - **HTTP transport (`--http` mode)**: Any `LOG_OUTPUT` option works > - ✅ `LOG_OUTPUT=console` visible in terminal
>   - ✅ `LOG_OUTPUT=stderr-all` visible in terminal
>   - ✅ `LOG_OUTPUT=file` writes to log file

## Rate Limiting Variables

- **`DT_MCP_RATE_LIMIT_MAX_CALLS`** (optional): Maximum number of tool calls allowed within the rate limit window. Default: `20`
- **`DT_MCP_RATE_LIMIT_WINDOW_MS`** (optional): Rate limit window size in milliseconds. Default: `20000` (20 seconds)

**Example:** Allow 50 calls per 30 seconds:

```bash
DT_MCP_RATE_LIMIT_MAX_CALLS=50
DT_MCP_RATE_LIMIT_WINDOW_MS=30000
```
