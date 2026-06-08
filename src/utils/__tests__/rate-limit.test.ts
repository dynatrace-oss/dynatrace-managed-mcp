import { getRateLimitConfig, RateLimiter } from '../rate-limit';

describe('getRateLimitConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DT_MCP_RATE_LIMIT_MAX_CALLS;
    delete process.env.DT_MCP_RATE_LIMIT_WINDOW_MS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns defaults when no env vars are set', () => {
    const config = getRateLimitConfig();
    expect(config.maxCalls).toBe(20);
    expect(config.windowMs).toBe(20000);
  });

  it('reads DT_MCP_RATE_LIMIT_MAX_CALLS from env', () => {
    process.env.DT_MCP_RATE_LIMIT_MAX_CALLS = '50';
    const config = getRateLimitConfig();
    expect(config.maxCalls).toBe(50);
    expect(config.windowMs).toBe(20000);
  });

  it('reads DT_MCP_RATE_LIMIT_WINDOW_MS from env', () => {
    process.env.DT_MCP_RATE_LIMIT_WINDOW_MS = '30000';
    const config = getRateLimitConfig();
    expect(config.maxCalls).toBe(20);
    expect(config.windowMs).toBe(30000);
  });

  it('reads both env vars when set', () => {
    process.env.DT_MCP_RATE_LIMIT_MAX_CALLS = '100';
    process.env.DT_MCP_RATE_LIMIT_WINDOW_MS = '60000';
    const config = getRateLimitConfig();
    expect(config.maxCalls).toBe(100);
    expect(config.windowMs).toBe(60000);
  });
});

describe('RateLimiter', () => {
  it('exposes the configured limits', () => {
    const rl = new RateLimiter({ maxCalls: 3, windowMs: 5000 });
    expect(rl.maxCalls).toBe(3);
    expect(rl.windowMs).toBe(5000);
  });

  it('allows up to maxCalls then blocks within the window', () => {
    let now = 1000;
    const rl = new RateLimiter({ maxCalls: 2, windowMs: 100, now: () => now });
    expect(rl.tryAcquire('user-a')).toBe(true);
    expect(rl.tryAcquire('user-a')).toBe(true);
    expect(rl.tryAcquire('user-a')).toBe(false);
  });

  it('tracks each user key independently', () => {
    let now = 1000;
    const rl = new RateLimiter({ maxCalls: 1, windowMs: 100, now: () => now });
    expect(rl.tryAcquire('user-a')).toBe(true);
    expect(rl.tryAcquire('user-a')).toBe(false);
    // A different user is unaffected by user-a hitting the limit.
    expect(rl.tryAcquire('user-b')).toBe(true);
  });

  it('allows again once the window slides past old calls', () => {
    let now = 1000;
    const rl = new RateLimiter({ maxCalls: 1, windowMs: 100, now: () => now });
    expect(rl.tryAcquire('user-a')).toBe(true);
    now = 1050;
    expect(rl.tryAcquire('user-a')).toBe(false);
    now = 1101; // first call now outside the 100ms window
    expect(rl.tryAcquire('user-a')).toBe(true);
  });
});
