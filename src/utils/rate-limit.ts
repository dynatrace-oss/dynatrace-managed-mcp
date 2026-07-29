/**
 * Returns the rate limit configuration, reading from environment variables with defaults.
 * - DT_MCP_RATE_LIMIT_MAX_CALLS: max tool calls allowed per window (default: 20)
 * - DT_MCP_RATE_LIMIT_WINDOW_MS: window size in milliseconds (default: 20000)
 */
export function getRateLimitConfig(): { maxCalls: number; windowMs: number } {
  return {
    maxCalls: Number.parseInt(process.env.DT_MCP_RATE_LIMIT_MAX_CALLS ?? '20', 10),
    windowMs: Number.parseInt(process.env.DT_MCP_RATE_LIMIT_WINDOW_MS ?? '20000', 10),
  };
}

/**
 * Sliding-window rate limiter keyed by an opaque user key. State persists across requests
 * for the life of the process. In HTTP mode the key is per-token; in stdio it is a constant,
 * which reproduces the previous single-bucket behavior.
 */
export class RateLimiter {
  public readonly maxCalls: number;
  public readonly windowMs: number;
  private readonly now: () => number;
  private readonly buckets = new Map<string, number[]>();

  constructor(config: { maxCalls?: number; windowMs?: number; now?: () => number } = {}) {
    const defaults = getRateLimitConfig();
    this.maxCalls = config.maxCalls ?? defaults.maxCalls;
    this.windowMs = config.windowMs ?? defaults.windowMs;
    this.now = config.now ?? (() => Date.now());
  }

  /** Records a call for `userKey`; returns true if within the limit, false if rate-limited. */
  tryAcquire(userKey: string): boolean {
    const ts = this.now();
    const windowStart = ts - this.windowMs;

    const bucket = (this.buckets.get(userKey) ?? []).filter((t) => t > windowStart);

    if (bucket.length >= this.maxCalls) {
      this.buckets.set(userKey, bucket);
      return false;
    }

    bucket.push(ts);
    this.buckets.set(userKey, bucket);

    // Bound memory: drop other users' buckets whose calls are all outside the current window.
    for (const [key, times] of this.buckets) {
      if (key !== userKey && (times.length === 0 || times[times.length - 1] <= windowStart)) {
        this.buckets.delete(key);
      }
    }

    return true;
  }
}
