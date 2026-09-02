# @dynatrace-oss/dynatrace-managed-mcp

## Unreleased changes

### Breaking changes

- Telemetry is now disabled by default
- Removed `DT_MCP_DISABLE_TELEMETRY` environment variable, added `DT_MCP_ENABLE_TELEMETRY` in its place

## 1.1.1

### Changes

- Separated monolith job in the `release.yml` file into multiple job. This will prevent issues should any step fail in the future

## 1.1.0

### Security

- Added Host and Origin headers validation. To configure it use `DT_MCP_ALLOWED_HOSTS`, by default it will allow localhost hosts (`localhost`, `127.0.0.1` and `[::1]`)
- Malformed aliases will no longer be printed in logs. Instead, alias index will be printed to point which alias is wrong
- Pinned SHA of remaining GitHub actions in workflow files
- Applied enum type in zod verification for selected parameters in problems and security problems tools. This ensures that filters cannot be injected, and it ensures that its value is always correct
- Removed unused `user-agent.ts` file
- Removed unused and redundant packages

### Fixes

- Fixed status filter not being applied in `list_problems` tool by @jasssonpet in #236
- Fixed Managed API scopes that appear in logs
- Fixed license type in `package.json`

### Changes

- Changed defaults and set max values to number of returned records on selected list tools
- Changed default logging option to `file+stderr`. This enables output in console by default in the stdio mode. Set `LOG_OUTPUT` environment variable to `file` to retain previous functionality

### Dependencies

| Type     | Name                                                                                                       | Old     | New     |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------- | ------- |
| deps     | fast-uri                                                                                                   | 3.1.5   | 3.1.6   |
| deps     | hono                                                                                                       | 4.12.30 | 4.13.4  |
| ci       | github/codeql-action/analyze                                                                               | New     | 4.37.9  |
| ci       | github/codeql-action/init                                                                                  | New     | 4.37.9  |
| ci       | docker/setup-buildx-action                                                                                 | 4.2.0   | 4.3.0   |
| ci       | google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml                                       | 2.3.8   | 2.5.1   |
| ci       | actions/setup-node                                                                                         | 6       | 7.0.0   |
| ci       | actions/actions/setup-python                                                                               | 6       | 7.0.0   |
| deps-dev | brace-expansion; for details check https://github.com/dynatrace-oss/dynatrace-managed-mcp/pull/245/changes | varies  | varies  |
| deps     | open                                                                                                       | 11.0.0  | Removed |
| deps     | undici                                                                                                     | 8.9.0   | Removed |
| deps     | zod-to-json-schema                                                                                         | ^3.25.1 | Removed |
| deps-dev | ts-node                                                                                                    | 10.9.2  | Removed |
| deps-dev | @types/axios                                                                                               | 0.14.4  | Removed |
| deps-dev | @types/js-yaml                                                                                             | 4.0.9   | Removed |
| deps-dev | @types/node                                                                                                | 26.2.0  | 26.4.0  |

### Documentation

- Overhauled `README.md` file: removed false and redundant information, moved non-critical documentation to separate files in `docs` folder (with links in README.md), moved critical information about starting the MCP server to the start of the file whilst improving wording for more human readability
  - Moved following sections to separate files:
    - Architecture
    - Environment variables
    - Rule file
  - Reduced cognitive load by moving following sections to expandable sections in `README.md` file:
    - Use cases
    - Capabilities
- Created new documentation files in `docs` folder:
  - Api token scopes: a table containing all tools, endpoints they call and required API token scopes to access them
  - Changelog format: document which defines how should changelog (and subsequently release notes) be structured
- Removed false and redundant information from DEVELOPMENT.md file
- Release notes will now be automatically extracted from changelog for given version

## 1.0.1

### Dependencies

| Type   | Name                      | Old    | New    |
| ------ | ------------------------- | ------ | ------ |
| ci     | docker/login-action       | 4.5.2  | 4.6.0  |
| deps   | fast-uri                  | 3.1.4  | 3.1.5  |
| deps   | ip-address                | 10.2.0 | 10.4.0 |
| deps   | @modelcontextprotocol/sdk | 1.29.0 | 1.30.0 |
| docker | node                      | 26.3.1 | 26.5.1 |
| engine | node                      | None   | 26.5.1 |

### Changes

- Added `engine` property to `package.json` and defined `node` version to `>=26.5.1 <27`. Failure to provide proper version will result in a warning

### Documentation

- npm badge in `README.md` file now correctly displays number of monthly downloads and points to correct repository
- Changed order and colours of badges in `README.md` file. Colours were extracted from Barista library

## 1.0.0

### Breaking changes

- Security (HTTP mode): unauthenticated requests are now rejected. A request that omits the `X-Dynatrace-Tokens` header, or supplies no token that is valid on its environment, receives HTTP 401 before any MCP server or tool is created. Previously such a request could complete the MCP `initialize` handshake and call tools — including `get_environments_info`, which disclosed configured environment aliases and URLs.
- Removed the `dynatrace_managed_check_config_errors` tool. The startup configuration errors it reported are redundant with `get_environments_info`; any automation referencing this tool by name must be updated.
- The server no longer starts when any configured environment is invalid — configuration errors now fail startup instead of being skipped. Fix all environment configuration errors before starting.

### Changes

- Added `DT_MCP_TOKEN_VALIDATION_TTL_MS` (default `60000`) to control how long per-caller token-validation results are cached.
- Updated `fast-uri` to 3.1.4.
- Hardened the CI and release pipeline: pinned all GitHub Actions to full commit SHAs, installed dependencies with `npm ci --ignore-scripts`, pinned `jsonschema` to `4.26.0` with `--only-binary`, and forced HTTPS for release-tooling downloads.
- Reordered the optional `params` argument to be last in the `listAvailableMetrics`, `listProblems`, `listSecurityProblems`, and `listSlos` capability-client methods so the default value applies. This is an internal API change only and does not affect MCP tool behavior.

### Fixes

- Per-request tokens are validated against the cluster (`POST /api/v2/apiTokens/lookup`) before tools are exposed. Validation results are cached per caller (keyed by a hash of the supplied tokens) and concurrent requests share a single validation, so the cluster is not probed on every request.
- `get_environments_info` now reports only on environments the caller supplied a token for, and returns an identical "invalid token" message whether an alias is unknown or its token is invalid — so callers can no longer enumerate which environments are configured.
- Improved `get_environments_info` in stdio mode: now uses cached startup validation results (version, validity, error) instead of re-probing live on every call, eliminating redundant network requests. The cluster version and minimum version check are now displayed from the cached result.
- Improved rate-limiting key stability: `deriveUserKey` now normalises the `X-Dynatrace-Tokens` header (sorts aliases, strips whitespace) so equivalent token sets produce the same rate-limit bucket regardless of header ordering.
- Resolved SonarQube blocker, security, and code-quality findings across the server through internal refactors, with no change to tool behavior, output, or configuration.
- Fixed an ineffective assertion in the metrics pagination integration test that was not actually verifying its condition.

## 0.6.0

- **Breaking change (HTTP mode):** the HTTP server no longer uses server-side API tokens. Each request must supply per-environment tokens via the `X-Dynatrace-Tokens` header (`alias=token;alias=token`); the server authenticates each environment with the caller's token, so each user only accesses data their token allows. In HTTP mode, environment config no longer requires `apiToken` (just `alias` + URLs). Run the HTTP server behind TLS. Rate limiting is now per-token. **stdio / local mode is unchanged** (tokens still come from the local config file / env vars).
- Documented HTTP header size limits for large multi-environment deployments: Node.js enforces a 16 KB default (approximately 140–150 environments); use `--max-http-header-size` to increase it. Added nginx example for raising the `large_client_header_buffers` limit when running behind a reverse proxy.
- Fixed Docker container build failure caused by `ts-jest@29.4.6` incompatibility with TypeScript 6; updated `ts-jest` to 29.4.11 (supports TypeScript `>=4.3 <7`) and added `tsconfig.test.json` so Jest type definitions resolve correctly under TypeScript 6.
- Fixed TypeScript 6 build error: migrated `tsconfig.json` from deprecated `moduleResolution: "node"` to `"bundler"`; TypeScript 6 treats the old setting as a hard error on clean builds (e.g., in Docker).

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
