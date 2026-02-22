import { getRateLimitConfig } from '../rate-limit';

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
