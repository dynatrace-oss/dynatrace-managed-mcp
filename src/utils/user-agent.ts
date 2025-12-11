import { getPackageJsonVersion } from './version';

/**
 * Generate a user agent string for Dynatrace MCP Server
 * @returns User agent string in format: dynatrace-managed-mcp/vX.X.X (platform-arch)
 */
export const getUserAgent = (): string => {
  return `dynatrace-managed-mcp/v${getPackageJsonVersion()} (${process.platform}-${process.arch})`;
};
