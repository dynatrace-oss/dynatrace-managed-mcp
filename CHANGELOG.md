# @dynatrace-oss/dynatrace-managed-mcp

## 0.6.0

- **Breaking change (HTTP mode):** the HTTP server no longer uses server-side API tokens. Each request must supply per-environment tokens via the `X-Dynatrace-Tokens` header (`alias=token;alias=token`); the server authenticates each environment with the caller's token, so each user only accesses data their token allows. In HTTP mode, environment config no longer requires `apiToken` (just `alias` + URLs). Run the HTTP server behind TLS. Rate limiting is now per-token. **stdio / local mode is unchanged** (tokens still come from the local config file / env vars).
- Documented HTTP header size limits for large multi-environment deployments: Node.js enforces a 16 KB default (approximately 140–150 environments); use `--max-http-header-size` to increase it. Added nginx example for raising the `large_client_header_buffers` limit when running behind a reverse proxy.
- Fixed Docker container build failure caused by `ts-jest@29.4.6` incompatibility with TypeScript 6; updated `ts-jest` to 29.4.11 (supports TypeScript `>=4.3 <7`) and added `tsconfig.test.json` so Jest type definitions resolve correctly under TypeScript 6.

## 0.5.7

- Fixed HTTP transport to return `application/json` responses instead of keeping persistent SSE connections open. This resolves indefinite hangs experienced by MCP clients (such as GitHub Copilot CLI) that do not support server-sent event streams.
- Fixed tool `inputSchema` in `tools/list` responses to strip the `$schema` and `additionalProperties` fields added by the MCP SDK. These caused HTTP 400 errors from OpenAI-compatible model APIs with strict JSON Schema validation, preventing tool use in clients such as GitHub Copilot CLI.
- **Breaking change**: Renamed tool `dynatrace_managed_check_for_configuration_errors` to `dynatrace_managed_check_config_errors` to comply with the 64-character function name limit imposed by OpenAI-compatible model APIs when tool names are namespace-qualified by the MCP client. MCP clients that discover tools dynamically (the typical case) are unaffected; any automation or configuration referencing the old tool name by string must be updated.
- Refactored HTTP server to create a fresh `McpServer` instance per request, satisfying the MCP SDK stateless HTTP requirement and preventing transport reuse errors.
- Added configurable rate limiting via `DT_MCP_RATE_LIMIT_MAX_CALLS` and `DT_MCP_RATE_LIMIT_WINDOW_MS` environment variables. You can now tune the rate limit to your needs. Defaults changed from 5 calls per 20 seconds to 20 calls per 20 seconds.
- Fixed typo in `MetricDataResponse` interface: renamed `vaules` field to `values`
- Fixed typo in `dynatrace_managed_query_metrics_data` tool description: corrected "retreived" to "retrieved"
- Fixed `npm run build` on Windows
- Fixed security vulnerabilities in dependencies: updated `hono` to 4.12.2, `diff` to 4.0.4, and `minimatch` to latest patch versions

## 0.5.6

- Updated ajv dependency to version 8.18.0 to address SNYK-JS-AJV-15274295 security vulnerability (ReDoS in schema compilation)

## 0.5.5

- Added multi-format configuration support with `DT_CONFIG_FILE` environment variable
  - Supports JSON and YAML configuration files for cleaner, more readable configuration
  - YAML files support comments for better documentation
  - Environment variable interpolation with `${VAR_NAME}` syntax enables secure token management
  - Configuration files can be version-controlled without exposing secrets
  - Cross-platform path resolution (supports relative paths, absolute paths, `~` expansion)
  - Configuration priority: `DT_CONFIG_FILE` > `DT_ENVIRONMENT_CONFIGS` (backward compatible)
  - See `examples/dt-config.yaml` and `examples/dt-config.json` for practical examples
- Fixed Docker build TypeScript errors by removing invalid `elicitation` capability (client-only feature), simplifying type annotations to prevent deep type instantiation issues, and migrating to `registerTool` API from deprecated `tool` method
- Improved logging configuration with comprehensive environment variables `LOG_OUTPUT` and `LOG_FILE`, providing greater flexibility for log destinations. You can now:
  - Redirect logs to stdout (`stdout` or `console`), stderr (errors/warnings only with `stderr`, or all levels with `stderr-all`), or a custom file path
  - Use multiple destinations simultaneously (e.g., `file+console` to log to both file and stdout, or `file+stderr` for file logging with errors to stderr)
  - Disable logging entirely with `disabled`
- Improved log readability for console and stderr output by switching from JSON to human-readable format (`YYYY-MM-DD HH:mm:ss.SSS [level] message`), making debugging easier when using `LOG_OUTPUT=console` or `LOG_OUTPUT=stderr-all`. File logging continues to use JSON format for machine parsing
- Added runtime warning when `LOG_OUTPUT=console` or `LOG_OUTPUT=stdout` is used with stdio transport (default for VS Code), guiding users to use `LOG_OUTPUT=stderr-all` or `LOG_OUTPUT=file` instead, as stdout is reserved for MCP protocol communication
- Enhanced documentation with clear guidance on which `LOG_OUTPUT` settings work with stdio transport (VS Code, Claude Desktop) versus HTTP transport, including practical examples for each scenario

## 0.5.3

- Add multi-environment support, enabling you to connect to multiple Dynatrace Managed deployments simultaneously through a unified configuration

## 0.5.0

- Add arm container image
- Prepare release to ghcr

## 0.4.0

- Use lowercase mcpName

## 0.3.0

- Fixed server.json schema validation

## 0.2.0

- Updated server.json schema to 11.12.2025

## 0.1.0

- First npm release

## 0.0.1

- Initial Release
