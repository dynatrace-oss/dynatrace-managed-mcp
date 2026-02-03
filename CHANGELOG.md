# @dynatrace-oss/dynatrace-managed-mcp

## Unreleased Changes

- Improved logging configuration with comprehensive environment variables `LOG_OUTPUT` and `LOG_FILE`, providing greater flexibility for log destinations. You can now:
  - Redirect logs to stdout (`stdout` or `console`), stderr (errors/warnings only with `stderr`, or all levels with `stderr-all`), or a custom file path
  - Use multiple destinations simultaneously (e.g., `file+console` to log to both file and stdout, or `file+stderr` for file logging with errors to stderr)
  - Disable logging entirely with `disabled`

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
