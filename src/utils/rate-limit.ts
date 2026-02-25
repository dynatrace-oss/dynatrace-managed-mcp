/**
 * Returns the rate limit configuration, reading from environment variables with defaults.
 * - DT_MCP_RATE_LIMIT_MAX_CALLS: max tool calls allowed per window (default: 20)
 * - DT_MCP_RATE_LIMIT_WINDOW_MS: window size in milliseconds (default: 20000)
 */
export function getRateLimitConfig(): { maxCalls: number; windowMs: number } {
  return {
    maxCalls: parseInt(process.env.DT_MCP_RATE_LIMIT_MAX_CALLS ?? '20', 10),
    windowMs: parseInt(process.env.DT_MCP_RATE_LIMIT_WINDOW_MS ?? '20000', 10),
  };
}
