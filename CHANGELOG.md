# @dynatrace-oss/dynatrace-managed-mcp

## Unreleased Changes

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
