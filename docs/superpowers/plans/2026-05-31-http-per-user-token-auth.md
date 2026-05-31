# HTTP Per-User Token Passthrough — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In HTTP mode, authenticate every Dynatrace request with a per-user token supplied in the `X-Dynatrace-Tokens` header (an `alias=token;alias=token` map) instead of shared server-side tokens, so each user only accesses what their token allows. stdio mode is unchanged for users.

**Architecture:** Split the auth layer into a shared, token-less startup registry (`ManagedAuthClient` instances that hold URLs/proxy/axios but no token) and a cheap per-request `ManagedAuthClientManager` that carries the caller's `Map<alias, token>`. The per-request MCP server factory builds the manager + API clients per request from the parsed header. `ManagedAuthClient` sets `Authorization` per call, never on shared axios defaults, so concurrent users don't cross-contaminate. stdio drives the same path with a token map built once from config.

**Tech Stack:** TypeScript (CommonJS), `@modelcontextprotocol/sdk` (Streamable HTTP, stateless), axios, commander, Jest + ts-jest (`unit` and `integration` projects), Node `node:crypto` / `node:http`.

**Spec:** `docs/superpowers/specs/2026-05-31-http-per-user-token-auth-design.md`

**Conventions for every task:** exact file paths; TDD (write the failing test, watch it fail, implement, watch it pass); commit at the end of each task. The husky pre-commit hook runs `npm run test:unit`, so unit tests must be green before each commit.

---

## Task 0: Install dependencies and capture a green baseline

**Files:** none (environment setup)

- [ ] **Step 1: Install dependencies**

Run: `npm ci`
Expected: completes; `node_modules/.bin/jest` and `node_modules/.bin/tsc` now exist.
(If `npm ci` fails because `package-lock.json` is out of sync, use `npm install`.)

- [ ] **Step 2: Verify the toolchain is available**

Run: `npx tsc --version && npx jest --version`
Expected: prints a TypeScript version (e.g. `Version 5.9.x`) and a Jest version (e.g. `30.x`).

- [ ] **Step 3: Build to confirm a clean starting point**

Run: `npm run build`
Expected: compiles with no errors.

- [ ] **Step 4: Run the unit suite to capture the baseline**

Run: `npm run test:unit`
Expected: all suites pass. Note the passing count — later tasks must keep these green (with the documented test updates).

No commit (no changes yet).

---

## Task 1: Token header parser + per-user key

Pure functions with no dependency on the rest of the system. Build them first so later tasks can rely on them.

**Files:**
- Create: `src/utils/token-header.ts`
- Test: `src/utils/__tests__/token-header.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/token-header.test.ts`:

```typescript
import { parseTokenHeader, deriveUserKey } from '../token-header';

// Silence + observe logger output
jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('parseTokenHeader', () => {
  it('parses an alias=token;alias=token map', () => {
    const map = parseTokenHeader('prod=dt0c01.AAA;staging=dt0c01.BBB');
    expect(map.get('prod')).toBe('dt0c01.AAA');
    expect(map.get('staging')).toBe('dt0c01.BBB');
    expect(map.size).toBe(2);
  });

  it('trims surrounding whitespace around aliases and tokens', () => {
    const map = parseTokenHeader('  prod = dt0c01.AAA ;  staging=dt0c01.BBB  ');
    expect(map.get('prod')).toBe('dt0c01.AAA');
    expect(map.get('staging')).toBe('dt0c01.BBB');
  });

  it('returns an empty map for undefined or empty input', () => {
    expect(parseTokenHeader(undefined).size).toBe(0);
    expect(parseTokenHeader('').size).toBe(0);
    expect(parseTokenHeader('   ').size).toBe(0);
  });

  it('skips malformed pairs that have no "="', () => {
    const map = parseTokenHeader('prod=dt0c01.AAA;garbage;=novalue;noalias=');
    expect(map.get('prod')).toBe('dt0c01.AAA');
    expect(map.size).toBe(1);
  });

  it('keeps only the first "=" so token values may contain "="', () => {
    const map = parseTokenHeader('prod=dt0c01.A=B=C');
    expect(map.get('prod')).toBe('dt0c01.A=B=C');
  });

  it('uses the last value when an alias is repeated', () => {
    const map = parseTokenHeader('prod=first;prod=second');
    expect(map.get('prod')).toBe('second');
  });

  it('joins an array-valued header before parsing', () => {
    const map = parseTokenHeader(['prod=dt0c01.AAA', 'staging=dt0c01.BBB']);
    expect(map.get('prod')).toBe('dt0c01.AAA');
    expect(map.get('staging')).toBe('dt0c01.BBB');
  });
});

describe('deriveUserKey', () => {
  it('returns "anonymous" when no token header is present', () => {
    expect(deriveUserKey(undefined)).toBe('anonymous');
    expect(deriveUserKey('')).toBe('anonymous');
    expect(deriveUserKey('   ')).toBe('anonymous');
  });

  it('is stable for the same input and is a 64-char hex digest', () => {
    const a = deriveUserKey('prod=dt0c01.AAA;staging=dt0c01.BBB');
    const b = deriveUserKey('prod=dt0c01.AAA;staging=dt0c01.BBB');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs for different token bundles', () => {
    expect(deriveUserKey('prod=AAA')).not.toBe(deriveUserKey('prod=BBB'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --selectProjects unit token-header`
Expected: FAIL — `Cannot find module '../token-header'`.

- [ ] **Step 3: Implement the module**

Create `src/utils/token-header.ts`:

```typescript
import { createHash } from 'node:crypto';
import { logger } from './logger';

/**
 * Parse the `X-Dynatrace-Tokens` header into an `alias -> token` map.
 * Format: `alias=token;alias=token`. Parsing is lenient — malformed pairs are skipped
 * (a redacted warning is logged) and a missing token surfaces later as a per-alias error.
 */
export function parseTokenHeader(headerValue: string | string[] | undefined): Map<string, string> {
  const tokens = new Map<string, string>();
  if (!headerValue) {
    return tokens;
  }
  const raw = Array.isArray(headerValue) ? headerValue.join(';') : headerValue;

  for (const pair of raw.split(';')) {
    const trimmed = pair.trim();
    if (trimmed === '') {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      logger.warn('Skipping malformed X-Dynatrace-Tokens entry (expected alias=token): [REDACTED]');
      continue;
    }
    const alias = trimmed.slice(0, eq).trim();
    const token = trimmed.slice(eq + 1).trim();
    if (alias === '' || token === '') {
      logger.warn(`Skipping malformed X-Dynatrace-Tokens entry for alias "${alias || '?'}": [REDACTED]`);
      continue;
    }
    tokens.set(alias, token); // duplicate alias -> last value wins
  }
  return tokens;
}

/**
 * Derive a stable, non-reversible per-user key from the raw token-header value, used to
 * scope rate limiting. Returns `'anonymous'` when no tokens are supplied.
 */
export function deriveUserKey(tokenHeaderValue: string | undefined): string {
  if (!tokenHeaderValue || tokenHeaderValue.trim() === '') {
    return 'anonymous';
  }
  return createHash('sha256').update(tokenHeaderValue).digest('hex');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --selectProjects unit token-header`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/utils/token-header.ts src/utils/__tests__/token-header.test.ts
git commit -m "feat: add X-Dynatrace-Tokens header parser and per-user key"
```

---

## Task 2: Per-token rate limiter

Extract rate limiting into a reusable, testable class keyed by user. Default behavior matches today's limits.

**Files:**
- Modify: `src/utils/rate-limit.ts` (append a `RateLimiter` class)
- Test: `src/utils/__tests__/rate-limit.test.ts` (append a `RateLimiter` describe block)

- [ ] **Step 1: Write the failing test**

Append to `src/utils/__tests__/rate-limit.test.ts` (after the existing `getRateLimitConfig` describe block; also add the import at the top):

Add to the top import line so it reads:

```typescript
import { getRateLimitConfig, RateLimiter } from '../rate-limit';
```

Append this describe block at the end of the file:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --selectProjects unit rate-limit`
Expected: FAIL — `RateLimiter is not a constructor` / not exported.

- [ ] **Step 3: Implement the class**

Append to `src/utils/rate-limit.ts` (keep the existing `getRateLimitConfig` export unchanged):

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --selectProjects unit rate-limit`
Expected: PASS (existing `getRateLimitConfig` tests + new `RateLimiter` tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/rate-limit.ts src/utils/__tests__/rate-limit.test.ts
git commit -m "feat: add per-user RateLimiter class"
```

---

## Task 3: Make the authentication layer token-stateless

Rewrite `src/authentication/managed-auth-client.ts`: the client takes the token per call (no `Authorization` baked into axios defaults); add `MissingTokenError`, the per-request `ManagedAuthClientManager`, and startup helpers. Update the unit test and both integration tests for the new signatures.

**Files:**
- Modify (full rewrite): `src/authentication/managed-auth-client.ts`
- Modify (full rewrite): `src/authentication/__tests__/managed-auth-client.test.ts`
- Modify: `tests/integration/managed-auth.integration.test.ts`
- Modify: `tests/integration/proxy.integration.test.ts`

- [ ] **Step 1: Rewrite the unit test to the new behavior (failing)**

Replace the entire contents of `src/authentication/__tests__/managed-auth-client.test.ts` with:

```typescript
import { ManagedAuthClient, ManagedAuthClientManager, MissingTokenError } from '../managed-auth-client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ManagedAuthClient', () => {
  let client: ManagedAuthClient;
  const mockCreate = jest.fn();

  beforeEach(() => {
    mockedAxios.create = mockCreate;
    mockCreate.mockReturnValue({ get: jest.fn() });
    client = new ManagedAuthClient({
      apiBaseUrl: 'https://managed.test.com',
      dashboardBaseUrl: 'https://managed-dashboard.test.com',
      alias: 'testAlias',
      minimum_version: '1.328.0',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates the axios instance without a baked-in Authorization header', () => {
      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: 'https://managed.test.com',
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'close',
        },
        timeout: 30000,
        maxRedirects: 0,
      });
    });
  });

  describe('makeRequest', () => {
    it('sets a per-call Authorization header from the supplied token', async () => {
      const mockGet = jest.fn().mockResolvedValue({ data: { ok: true } });
      mockCreate.mockReturnValue({ get: mockGet });
      client = new ManagedAuthClient({
        apiBaseUrl: 'https://managed.test.com',
        dashboardBaseUrl: 'https://managed-dashboard.test.com',
        alias: 'testAlias',
        minimum_version: '1.328.0',
      });

      const data = await client.makeRequest('/api/v2/metrics', 'token-A', { pageSize: 1 });

      expect(data).toEqual({ ok: true });
      expect(mockGet).toHaveBeenCalledWith('/api/v2/metrics', {
        proxy: undefined,
        params: { pageSize: 1 },
        headers: { Authorization: 'Api-Token token-A' },
      });
    });

    it('uses a different Authorization per call (no cross-contamination)', async () => {
      const mockGet = jest.fn().mockResolvedValue({ data: {} });
      mockCreate.mockReturnValue({ get: mockGet });
      client = new ManagedAuthClient({
        apiBaseUrl: 'https://managed.test.com',
        dashboardBaseUrl: 'https://managed-dashboard.test.com',
        alias: 'testAlias',
        minimum_version: '1.328.0',
      });

      await client.makeRequest('/x', 'token-A');
      await client.makeRequest('/x', 'token-B');

      expect(mockGet.mock.calls[0][1].headers).toEqual({ Authorization: 'Api-Token token-A' });
      expect(mockGet.mock.calls[1][1].headers).toEqual({ Authorization: 'Api-Token token-B' });
    });
  });

  describe('validateConnection', () => {
    it('tries the cluster version endpoint first, then falls back, sending the token both times', async () => {
      const mockGet = jest
        .fn()
        .mockRejectedValueOnce(new Error('Cluster version not available'))
        .mockResolvedValueOnce({ status: 200 });
      mockCreate.mockReturnValue({ get: mockGet });
      client = new ManagedAuthClient({
        apiBaseUrl: 'https://managed.test.com',
        dashboardBaseUrl: 'https://managed-dashboard.test.com',
        alias: 'testAlias',
        minimum_version: '1.328.0',
      });

      const result = await client.validateConnection('test-token');

      expect(result).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('/api/v1/config/clusterversion', {
        headers: { Authorization: 'Api-Token test-token' },
      });
      expect(mockGet).toHaveBeenCalledWith('/api/v2/metrics', {
        params: { pageSize: 1 },
        headers: { Authorization: 'Api-Token test-token' },
      });
    });
  });

  describe('validateMinimumVersion', () => {
    it('returns true for version above minimum', () => {
      expect(client.validateMinimumVersion({ version: '1.329.0' })).toBe(true);
    });
    it('returns false for version below minimum', () => {
      expect(client.validateMinimumVersion({ version: '1.319.0' })).toBe(false);
    });
    it('returns true for the exact minimum version', () => {
      expect(client.validateMinimumVersion({ version: '1.328.0' })).toBe(true);
    });
  });

  describe('getClusterVersion', () => {
    it('returns the minimum version when clusterversion is forbidden', async () => {
      const mockGet = jest.fn().mockRejectedValueOnce({ response: { status: 403 } });
      mockCreate.mockReturnValue({ get: mockGet });
      client = new ManagedAuthClient({
        apiBaseUrl: 'https://managed.test.com',
        dashboardBaseUrl: 'https://managed-dashboard.test.com',
        alias: 'testAlias',
        minimum_version: '1.328.0',
      });

      const result = await client.getClusterVersion('test-token');

      expect(result).toEqual({ version: '1.328.0' });
      expect(mockGet).toHaveBeenCalledWith('/api/v1/config/clusterversion', {
        headers: { Authorization: 'Api-Token test-token' },
      });
    });
  });
});

describe('ManagedAuthClientManager', () => {
  function fakeClient(alias: string) {
    return {
      alias,
      dashboardBaseUrl: `https://dash.${alias}.test`,
      makeRequest: jest.fn().mockResolvedValue({ ok: alias }),
    } as any;
  }

  it('routes a request to the matching client with that alias token', async () => {
    const prod = fakeClient('prod');
    const staging = fakeClient('staging');
    const mgr = new ManagedAuthClientManager(
      [prod, staging],
      [prod, staging],
      ['ALL_ENVIRONMENTS', 'prod', 'staging'],
      new Map([
        ['prod', 'tok-prod'],
        ['staging', 'tok-staging'],
      ]),
    );

    const res = await mgr.makeRequests('/api/x', { a: 1 }, 'prod');

    expect(prod.makeRequest).toHaveBeenCalledWith('/api/x', 'tok-prod', { a: 1 });
    expect(staging.makeRequest).not.toHaveBeenCalled();
    expect(res.get('prod')).toEqual({ ok: 'prod' });
  });

  it('throws MissingTokenError when no token is supplied for the requested alias', async () => {
    const prod = fakeClient('prod');
    const mgr = new ManagedAuthClientManager([prod], [prod], ['ALL_ENVIRONMENTS', 'prod'], new Map());

    await expect(mgr.makeRequests('/api/x', {}, 'prod')).rejects.toBeInstanceOf(MissingTokenError);
    await expect(mgr.makeRequests('/api/x', {}, 'prod')).rejects.toThrow(/Add `prod=<token>`/);
  });

  it('ALL_ENVIRONMENTS targets only the environments the caller has tokens for', async () => {
    const prod = fakeClient('prod');
    const staging = fakeClient('staging');
    const mgr = new ManagedAuthClientManager(
      [prod, staging],
      [prod, staging],
      ['ALL_ENVIRONMENTS', 'prod', 'staging'],
      new Map([['prod', 'tok-prod']]),
    );

    const res = await mgr.makeRequests('/api/x', {}, 'ALL_ENVIRONMENTS');

    expect(prod.makeRequest).toHaveBeenCalled();
    expect(staging.makeRequest).not.toHaveBeenCalled();
    expect([...res.keys()]).toEqual(['prod']);
  });

  it('getBaseUrl returns the dashboard URL for an alias', () => {
    const prod = fakeClient('prod');
    const mgr = new ManagedAuthClientManager([prod], [prod], ['ALL_ENVIRONMENTS', 'prod'], new Map());
    expect(mgr.getBaseUrl('prod')).toBe('https://dash.prod.test');
    expect(mgr.getBaseUrl('nope')).toBe('');
  });

  it('tokenFor returns the caller token for an alias', () => {
    const prod = fakeClient('prod');
    const mgr = new ManagedAuthClientManager([prod], [prod], ['ALL_ENVIRONMENTS', 'prod'], new Map([['prod', 't']]));
    expect(mgr.tokenFor('prod')).toBe('t');
    expect(mgr.tokenFor('missing')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `npx jest --selectProjects unit managed-auth-client`
Expected: FAIL — the current module has no `MissingTokenError`/`ManagedAuthClientManager` token API, and the constructor still bakes in `Authorization`.

- [ ] **Step 3: Rewrite the implementation**

Replace the entire contents of `src/authentication/managed-auth-client.ts` with:

```typescript
import axios, { AxiosInstance, AxiosProxyConfig } from 'axios';
import { logger } from '../utils/logger';
import { ManagedEnvironmentConfig } from '../utils/environment';

export const MINIMUM_VERSION = '1.328.0';

const MANAGED_API_SCOPES = [
  'DataExport', // Read metrics and topology
  'ReadConfig', // Read configuration and cluster version
  'ReadSyntheticData', // Read synthetic monitoring data
  'ReadLogContent', // Read log content
  'ReadEvents', // Read events
  'ReadProblems', // Read problems and root cause analysis
  'ReadSecurityProblems', // Read security problems
  'ReadSLO', // Read Service Level Objectives
];

export interface ClusterVersion {
  version: string;
}

export interface ManagedAuthClientParams {
  apiBaseUrl: string;
  dashboardBaseUrl: string;
  alias: string;
  httpProxy?: string;
  httpsProxy?: string;
  isValid?: boolean;
  minimum_version: string;
}

/** Thrown when a request targets an environment for which the caller supplied no token. */
export class MissingTokenError extends Error {
  constructor(public readonly alias: string) {
    super(`No token supplied for environment '${alias}'. Add \`${alias}=<token>\` to your X-Dynatrace-Tokens header.`);
    this.name = 'MissingTokenError';
  }
}

export class ManagedAuthClient {
  public apiBaseUrl: string;
  public dashboardBaseUrl: string;
  public alias: string;
  public isValid: boolean;
  public validationError: string;
  private proxy: AxiosProxyConfig | undefined;
  private httpClient: AxiosInstance;
  public MINIMUM_VERSION: string;

  constructor(params: ManagedAuthClientParams) {
    this.apiBaseUrl = params.apiBaseUrl;
    this.dashboardBaseUrl = params.dashboardBaseUrl;
    this.alias = params.alias;
    this.proxy = setAxiosProxy(params.httpProxy, params.httpsProxy);
    this.isValid = params.isValid ? params.isValid : false;
    this.MINIMUM_VERSION = params.minimum_version;
    this.validationError = '';

    // NOTE: Authorization is intentionally NOT baked in here. The token is provided per call
    // (per user) so one shared client instance can serve many callers concurrently.
    this.httpClient = axios.create({
      baseURL: this.apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close',
      },
      timeout: 30000,
      maxRedirects: 0,
    });
  }

  private authHeader(token: string): Record<string, string> {
    return { Authorization: `Api-Token ${token}` };
  }

  async validateConnection(token: string): Promise<boolean> {
    try {
      // Try cluster version endpoint for Managed environments
      const response = await this.httpClient.get('/api/v1/config/clusterversion', {
        headers: this.authHeader(token),
      });
      return response.status === 200;
    } catch (error) {
      logger.error(
        `[Alias: ${this.alias}] Failed calling /api/v1/config/clusterversion; falling back to /api/v2/metrics`,
        { error: error },
      );
      // Fallback: try a basic API endpoint that exists in both SaaS and Managed
      try {
        const response = await this.httpClient.get('/api/v2/metrics', {
          params: { pageSize: 1 },
          headers: this.authHeader(token),
        });
        return response.status === 200;
      } catch (fallbackError) {
        logger.error(`[Alias: ${this.alias}] Failed calling /api/v2/metrics`, { error: fallbackError });
        return false;
      }
    }
  }

  async getClusterVersion(token: string): Promise<ClusterVersion> {
    try {
      const response = await this.httpClient.get('/api/v1/config/clusterversion', {
        headers: this.authHeader(token),
      });
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        logger.warn(
          `[Alias: ${this.alias}] No permission for /api/v1/config/clusterversion; using minimum version ${this.MINIMUM_VERSION}`,
        );
        return { version: this.MINIMUM_VERSION };
      }
      throw error;
    }
  }

  validateMinimumVersion(clusterVersion: ClusterVersion): boolean {
    const version = clusterVersion.version;

    // Compare version strings (e.g., "1.320.0" >= "1.320")
    const versionParts = version.split('.').map(Number);
    const minVersionParts = this.MINIMUM_VERSION.split('.').map(Number);

    for (let i = 0; i < Math.max(versionParts.length, minVersionParts.length); i++) {
      const current = versionParts[i] || 0;
      const minimum = minVersionParts[i] || 0;

      if (current > minimum) return true;
      if (current < minimum) return false;
    }

    return true; // Equal versions
  }

  cleanup(): void {
    // Destroy the axios instance to close connections
    if (this.httpClient) {
      this.httpClient.interceptors.request.clear();
      this.httpClient.interceptors.response.clear();
      this.httpClient.defaults.timeout = 1;
      (this.httpClient as any) = null;
    }
  }

  async makeRequest(endpoint: string, token: string, params: Record<string, any> = {}): Promise<any> {
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const response = await this.httpClient.get(url, {
      proxy: this.proxy ?? undefined,
      params,
      headers: this.authHeader(token),
    });
    return response.data;
  }

  async isConfigured(token: string): Promise<boolean> {
    logger.info(`Testing connection to Dynatrace Managed environment "${this.alias}": ${this.apiBaseUrl}...`);
    try {
      const isConnected = await this.validateConnection(token);
      if (!isConnected) {
        this.validationError = "Connection validation failed: Can't connect to environment " + this.alias;
        return false;
      }
      const clusterVersion = await this.getClusterVersion(token);
      logger.info(`Connected to Managed cluster version ${clusterVersion.version}`);

      const isValidVersion = this.validateMinimumVersion(clusterVersion);
      if (!isValidVersion) {
        const invalidVersionMessage = `Environment "${this.alias}" version ${clusterVersion.version} may not support all features. Minimum recommended version is ${this.MINIMUM_VERSION}`;
        logger.info(invalidVersionMessage);
        this.validationError = invalidVersionMessage;
        return false;
      }
      return true;
    } catch (error: any) {
      logger.error(
        `[CONNECTION ERROR] Failed to connect to Managed environment "${this.alias}": ${this.apiBaseUrl}: ${error.message}.`,
      );
      logger.error('Please verify:');
      logger.error('1. The environment configuration (apiEndpointUrl, environmentId) is correct');
      logger.error(`2. API Token has required scopes: ${MANAGED_API_SCOPES.join(', ')}`);
      logger.error('3. Network connectivity to the Managed environment');
      this.validationError = `Failed to connect to Managed environment "${this.alias}": ${this.apiBaseUrl}: ${error.message}. Please verify connection details are correct.`;
      return false;
    }
  }
}

/** Build the shared, token-less clients for all configured environments (startup, once). */
export function buildManagedAuthClients(configs: ManagedEnvironmentConfig[]): ManagedAuthClient[] {
  return configs.map(
    (env) =>
      new ManagedAuthClient({
        apiBaseUrl: env.apiUrl,
        dashboardBaseUrl: env.dashboardUrl,
        alias: env.alias,
        httpProxy: env.httpProxy,
        httpsProxy: env.httpsProxy,
        minimum_version: MINIMUM_VERSION,
      }),
  );
}

/** stdio startup validation using config-provided tokens. Returns the reachable subset. */
export async function validateManagedClients(
  clients: ManagedAuthClient[],
  tokens: Map<string, string>,
): Promise<{ validClients: ManagedAuthClient[]; validAliases: string[] }> {
  const validClients: ManagedAuthClient[] = [];
  const validAliases: string[] = ['ALL_ENVIRONMENTS'];
  for (const client of clients) {
    const token = tokens.get(client.alias) ?? '';
    const ok = await client.isConfigured(token);
    if (ok) {
      client.isValid = true;
      validClients.push(client);
      validAliases.push(client.alias);
    }
  }
  return { validClients, validAliases };
}

/**
 * Per-request router. Holds references to the shared clients plus this caller's tokens.
 * Cheap to construct (one per HTTP request); the API clients consume it exactly as before.
 */
export class ManagedAuthClientManager {
  public readonly MINIMUM_VERSION = MINIMUM_VERSION;

  constructor(
    public readonly rawClients: ManagedAuthClient[],
    public clients: ManagedAuthClient[],
    public validAliases: string[],
    private readonly tokens: Map<string, string>,
  ) {}

  /** The caller's token for an alias, or undefined. Used by get_environments_info. */
  tokenFor(alias: string): string | undefined {
    return this.tokens.get(alias);
  }

  async makeRequests(endpoint: string, params: Record<string, any>, environments: string): Promise<Map<string, any>> {
    const selectedAliases =
      environments === 'ALL_ENVIRONMENTS'
        ? this.clients.map((c) => c.alias).filter((alias) => this.tokens.has(alias))
        : environments.split(';');

    const responses = new Map<string, any>();
    for (const client of this.clients) {
      if (selectedAliases.indexOf(client.alias) > -1) {
        const token = this.tokens.get(client.alias);
        if (!token) {
          throw new MissingTokenError(client.alias);
        }
        const response = await client.makeRequest(endpoint, token, params);
        responses.set(client.alias, response);
      }
    }
    return responses;
  }

  getBaseUrl(alias: string): string {
    for (const client of this.clients) {
      if (client.alias === alias) {
        return client.dashboardBaseUrl;
      }
    }
    return '';
  }
}

export function setAxiosProxy(httpProxy = '', httpsProxy = ''): AxiosProxyConfig | undefined {
  if (httpsProxy && httpProxy) {
    logger.error('Cannot specify both HTTPS_PROXY and HTTP_PROXY, use only one.');
    return undefined;
  } else if (!httpsProxy && !httpProxy) {
    // No proxy configured, nothing to do
    return undefined;
  }

  try {
    let url: URL;
    let port: string;
    let protocol: string;

    if (httpsProxy) {
      url = new URL(httpsProxy);
      port = url.port ? url.port : '443';
      protocol = url.protocol ? url.protocol : 'https';
    } else if (httpProxy) {
      url = new URL(httpProxy);
      port = url.port ? url.port : '80';
      protocol = url.protocol ? url.protocol : 'http';
    } else {
      // No proxy configured, nothing to do
      return undefined;
    }

    logger.info(`Configuring HTTP Proxy for Axios client: ${url.hostname}:${port}`);

    return {
      host: url.hostname,
      port: Number(port),
      protocol: protocol,
      auth: url.username
        ? { username: decodeURIComponent(url.username), password: decodeURIComponent(url.password) }
        : undefined,
    };
  } catch (err: any) {
    logger.error(`Failed to configure HTTP Proxy for Axios client: ${err.message}`);
    throw Error('Failed to parse and configure http(s) proxy', { cause: err });
  }
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npx jest --selectProjects unit managed-auth-client`
Expected: PASS (client + manager describe blocks).

- [ ] **Step 5: Update the integration tests for the new signatures**

In `tests/integration/managed-auth.integration.test.ts`: drop `apiToken` from the constructor, capture the config token, and pass it to the methods. Replace the file body's `beforeAll` and the three `it` blocks with:

```typescript
(skip ? describe.skip : describe)('ManagedAuthClient Integration', () => {
  let client: ManagedAuthClient;
  let apiToken: string;

  beforeAll(() => {
    const config = getManagedEnvironmentConfigs();
    const environments = validateEnvironments(config);
    const valid_client = environments['valid_configs'][0];
    apiToken = valid_client.apiToken;

    client = new ManagedAuthClient({
      apiBaseUrl: valid_client.apiUrl,
      dashboardBaseUrl: valid_client.dashboardUrl,
      alias: valid_client.alias,
      minimum_version: '1.328.0',
    });
  });

  afterAll(async () => {
    if (client) {
      client.cleanup();
    }
  });

  it('should validate connection to real Managed cluster', async () => {
    const isValid = await client.validateConnection(apiToken);
    expect(isValid).toBe(true);
  }, 30000);

  it('should get cluster version from real Managed cluster', async () => {
    const version = await client.getClusterVersion(apiToken);
    expect(version).toHaveProperty('version');
    expect(typeof version.version).toBe('string');
    expect(version.version).toMatch(/^\d+\.\d+\.\d+/);
  }, 30000);

  it('should validate minimum version requirement', async () => {
    const version = await client.getClusterVersion(apiToken);
    const isValidVersion = client.validateMinimumVersion(version);
    expect(typeof isValidVersion).toBe('boolean');
  }, 30000);
});
```

In `tests/integration/proxy.integration.test.ts`: drop `apiToken` from the constructor and pass a token to `makeRequest`. Change the client construction and the request call inside the `it('should use HTTP_PROXY', ...)` block to:

```typescript
      let client = new ManagedAuthClient({
        apiBaseUrl: 'http://example.com',
        dashboardBaseUrl: 'http://example-dashboard.com',
        alias: 'alias',
        httpsProxy: proxyUrl,
        minimum_version: '1.328.0',
      });

      const response = await client.makeRequest('/anything/mypath', 'my-example-token');
```

- [ ] **Step 6: Type-check the integration project compiles**

Run: `npx tsc --noEmit --skipLibCheck --esModuleInterop --module commonjs --target ESNext --moduleResolution node tests/integration/managed-auth.integration.test.ts tests/integration/proxy.integration.test.ts`
Expected: no errors. This compiles just these two files (and their imports) without the project's test-exclude and without any network access, confirming the new signatures line up. (`managed-auth.integration.test.ts` is `describe.skip` without creds and `proxy.integration.test.ts` only runs under `npm run test:integration`; this step only type-checks them.)

- [ ] **Step 7: Confirm the src build still compiles**

Run: `npm run build`
Expected: FAIL — `src/index.ts` still calls the old `new ManagedAuthClientManager(initConfigs)` / `authClientManager.isConfigured()` / `makeRequest(endpoint, params)`. This is expected; `index.ts` is rewired in Task 5. Do not try to fix `index.ts` here.

> Because `index.ts` will not compile until Task 5, this task's commit relies on the unit tests (which compile `managed-auth-client.ts` and its test in isolation under ts-jest). The pre-commit hook runs `test:unit`, which passes.

- [ ] **Step 8: Commit**

```bash
git add src/authentication/managed-auth-client.ts \
        src/authentication/__tests__/managed-auth-client.test.ts \
        tests/integration/managed-auth.integration.test.ts \
        tests/integration/proxy.integration.test.ts
git commit -m "refactor: make ManagedAuthClient token-stateless with per-request manager"
```

---

## Task 4: Mode-aware config validation + config token map

Make `apiToken` optional in HTTP mode and add a helper to build the stdio token map from config. Backward compatible via a `requireToken = true` default, so existing tests stay green.

**Files:**
- Modify: `src/utils/environment.ts`
- Modify: `src/utils/config-loader.ts`
- Test: `src/utils/__tests__/environment.test.ts` (append cases)
- Test: `src/utils/__tests__/config-loader.test.ts` (append a case)

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/__tests__/environment.test.ts` (inside the existing `describe('getManagedEnvironmentConfig', ...)` block, after the last `it`); also update the top import to include `buildConfigTokenMap`:

Change the import line to:

```typescript
import { getManagedEnvironmentConfigs, validateEnvironments, buildConfigTokenMap } from '../environment';
```

Append these tests:

```typescript
  it('does not require apiToken when requireToken is false (HTTP mode)', () => {
    process.env.DT_ENVIRONMENT_CONFIGS = fullEnv;
    const config = getManagedEnvironmentConfigs();
    const validated = validateEnvironments(config, false);
    const aliases = validated.valid_configs.map((c) => c.alias);

    // Env #3 has no apiToken — valid in HTTP mode.
    expect(aliases).toContain('missing-api-key-env-id-3');
    // Structural problems are still rejected regardless of token mode.
    expect(aliases).not.toContain('invalid-alias-env-id;-2'); // semicolon in alias
    expect(aliases).not.toContain('missing-api-url-env-5'); // missing apiEndpointUrl
  });

  it('buildConfigTokenMap maps alias -> token and skips empty tokens', () => {
    const map = buildConfigTokenMap([
      { alias: 'a', apiToken: 't1', apiUrl: 'u', dashboardUrl: 'd', environmentId: 'e' },
      { alias: 'b', apiToken: '', apiUrl: 'u', dashboardUrl: 'd', environmentId: 'e' },
    ]);
    expect(map.get('a')).toBe('t1');
    expect(map.has('b')).toBe(false);
  });
```

Append to `src/utils/__tests__/config-loader.test.ts` (inside the `describe('Configuration validation', ...)` block, after the last `it`):

```typescript
    it('does not require apiToken when requireToken is false', () => {
      const configPath = path.join(testDir, 'config.json');
      const config = [
        {
          apiEndpointUrl: 'https://api.example.com/',
          environmentId: 'test-123',
          alias: 'production',
        },
      ];

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = ConfigFileLoader.loadFromFile(configPath, false);
      expect(result).toHaveLength(1);
      expect(result[0].alias).toBe('production');
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --selectProjects unit environment config-loader`
Expected: FAIL — `validateEnvironments`/`loadFromFile` don't accept a second arg yet and `buildConfigTokenMap` isn't exported.

- [ ] **Step 3: Implement in `src/utils/environment.ts`**

Change `getManagedEnvironmentConfigs` to accept and forward `requireToken`. Replace its signature and the `loadFromFile` call:

```typescript
export function getManagedEnvironmentConfigs(requireToken = true): ManagedEnvironmentConfig[] {
```

and (inside the `DT_CONFIG_FILE` branch) change:

```typescript
      const environmentConfigurations = ConfigFileLoader.loadFromFile(process.env.DT_CONFIG_FILE);
```

to:

```typescript
      const environmentConfigurations = ConfigFileLoader.loadFromFile(process.env.DT_CONFIG_FILE, requireToken);
```

Change `validateEnvironments` to make the token requirement conditional. Replace its signature and `requiredKeys`:

```typescript
export function validateEnvironments(
  environmentConfigurations: ManagedEnvironmentConfig[],
  requireToken = true,
): {
  valid_configs: ManagedEnvironmentConfig[];
  errors: string[];
} {
  const requiredKeys = requireToken
    ? ['apiUrl', 'environmentId', 'alias', 'apiToken']
    : ['apiUrl', 'environmentId', 'alias'];
```

(Leave the rest of `validateEnvironments` — `originalKeys`, the loop, the alias semicolon check — unchanged.)

Add the helper at the end of the file:

```typescript
/** Build the alias -> token map from config (stdio mode, once at startup). */
export function buildConfigTokenMap(configs: ManagedEnvironmentConfig[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const config of configs) {
    if (config.apiToken) {
      map.set(config.alias, config.apiToken);
    }
  }
  return map;
}
```

- [ ] **Step 4: Implement in `src/utils/config-loader.ts`**

Thread `requireToken` through. Change `loadFromFile`'s signature:

```typescript
  static loadFromFile(filePath: string, requireToken = true): JSONObject[] {
```

Change its final call from:

```typescript
    return this.validateAndReturnConfig(config, resolvedPath);
```

to:

```typescript
    return this.validateAndReturnConfig(config, resolvedPath, requireToken);
```

Change `validateAndReturnConfig`:

```typescript
  private static validateAndReturnConfig(config: any[], filePath: string, requireToken = true): JSONObject[] {
    // Validate required fields
    const required = requireToken
      ? ['apiEndpointUrl', 'environmentId', 'alias', 'apiToken']
      : ['apiEndpointUrl', 'environmentId', 'alias'];
```

(Leave the rest of `validateAndReturnConfig` unchanged.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest --selectProjects unit environment config-loader`
Expected: PASS — new cases pass and all pre-existing cases (which rely on the default `requireToken = true`) still pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/environment.ts src/utils/config-loader.ts \
        src/utils/__tests__/environment.test.ts src/utils/__tests__/config-loader.test.ts
git commit -m "feat: make apiToken optional in HTTP mode and add config token map"
```

---

## Task 5: Wire HTTP per-user tokens into the server entrypoint

Restructure `src/index.ts`: parse CLI first, load config mode-aware, build shared clients, branch token source per mode, make the MCP-server factory per-request (tokens + userKey), parse the header in the HTTP handler, rewrite `get_environments_info`, and use the per-user rate limiter.

**Files:**
- Modify: `src/index.ts` (imports, module state, `main()` head, factory, `get_environments_info`, tool rate-limit, HTTP handler, stdio handler, remove the old CLI block)

> All edits are in one file. Apply them in order; each `old` snippet is unique. After all edits, verify with `npm run build` + `npm run test:unit`.

- [ ] **Step 1: Update imports**

Replace this import (currently around `src/index.ts:10-11`):

```typescript
import { ManagedAuthClientManager } from './authentication/managed-auth-client';
import { getManagedEnvironmentConfigs, validateEnvironments } from './utils/environment';
```

with:

```typescript
import {
  ManagedAuthClientManager,
  ManagedAuthClient,
  buildManagedAuthClients,
  validateManagedClients,
} from './authentication/managed-auth-client';
import { getManagedEnvironmentConfigs, validateEnvironments, buildConfigTokenMap } from './utils/environment';
import { parseTokenHeader, deriveUserKey } from './utils/token-header';
```

Replace this import (currently around `src/index.ts:22`):

```typescript
import { getRateLimitConfig } from './utils/rate-limit';
```

with:

```typescript
import { RateLimiter } from './utils/rate-limit';
```

- [ ] **Step 2: Replace module-level rate-limit state**

Replace (currently around `src/index.ts:41-45`):

```typescript
// Rate limiting configuration (configurable via DT_MCP_RATE_LIMIT_MAX_CALLS and DT_MCP_RATE_LIMIT_WINDOW_MS)
const { maxCalls: RATE_LIMIT_MAX_CALLS, windowMs: RATE_LIMIT_WINDOW_MS } = getRateLimitConfig();

// Rate limiting state: store timestamps of tool calls
let toolCallTimestamps: number[] = [];
```

with:

```typescript
// Per-user (per-token) rate limiter, shared across requests for the life of the process.
// In stdio mode there is a single user key, which reproduces the previous single-bucket behavior.
const rateLimiter = new RateLimiter();
```

- [ ] **Step 3: Restructure the head of `main()`**

Replace (currently `src/index.ts:47-84`, from `const main = async () => {` through the telemetry init):

```typescript
const main = async () => {
  logger.info(`Initializing Dynatrace Managed MCP Server v${getPackageJsonVersion()}...`);

  // Read Managed environment configuration

  const managedConfigs = getManagedEnvironmentConfigs();
  const validatedConfigs = validateEnvironments(managedConfigs);

  const initErrors = validatedConfigs['errors'];
  const initConfigs = validatedConfigs['valid_configs'];

  if (initErrors.length > 0) {
    logger.error('Failed to get managed environments configurations: ', { error: initErrors });
    console.error('Failed to get managed environments configurations: ', { error: initErrors });
  }

  if (initConfigs.length === 0) {
    logger.error('No valid environments found, stopping.');
    console.error('No valid environments found, stopping.');
    await flushLogger();
    process.exit(1);
  }

  const authClientManager = new ManagedAuthClientManager(initConfigs);
  await authClientManager.isConfigured();

  // Initialize API clients
  const metricsClient = new MetricsApiClient(authClientManager);
  const logsClient = new LogsApiClient(authClientManager);
  const eventsClient = new EventsApiClient(authClientManager);
  const entitiesClient = new EntitiesApiClient(authClientManager);
  const problemsClient = new ProblemsApiClient(authClientManager);
  const securityClient = new SecurityApiClient(authClientManager);
  const sloClient = new SloApiClient(authClientManager);

  // Initialize usage tracking
  const telemetry = createTelemetry();
  await telemetry.trackMcpServerStart();
```

with:

```typescript
const main = async () => {
  logger.info(`Initializing Dynatrace Managed MCP Server v${getPackageJsonVersion()}...`);

  // Parse CLI options first so the server mode is known before configuration is loaded.
  const program = new Command();
  program
    .name('dynatrace-managed-mcp')
    .description('Dynatrace Managed Model Context Protocol (MCP) Server')
    .version(getPackageJsonVersion())
    .option('--http', 'enable HTTP server mode instead of stdio')
    .option('--server', 'enable HTTP server mode (alias for --http)')
    .option('-p, --port <number>', 'port for HTTP server', '3000')
    .option('-H, --host <host>', 'host for HTTP server', '127.0.0.1')
    .parse();

  const options = program.opts();
  const httpMode = options.http || options.server;
  const httpPort = parseInt(options.port, 10);
  const host = options.host || '127.0.0.1';

  // Read Managed environment configuration. In HTTP mode tokens are supplied per request
  // (X-Dynatrace-Tokens header), so apiToken is not required in the config.
  const managedConfigs = getManagedEnvironmentConfigs(!httpMode);
  const validatedConfigs = validateEnvironments(managedConfigs, !httpMode);

  const initErrors = validatedConfigs['errors'];
  const initConfigs = validatedConfigs['valid_configs'];

  if (initErrors.length > 0) {
    logger.error('Failed to get managed environments configurations: ', { error: initErrors });
    console.error('Failed to get managed environments configurations: ', { error: initErrors });
  }

  if (initConfigs.length === 0) {
    logger.error('No valid environments found, stopping.');
    console.error('No valid environments found, stopping.');
    await flushLogger();
    process.exit(1);
  }

  // Build shared, token-less auth clients (axios instances are created once and reused).
  const allClients = buildManagedAuthClients(initConfigs);

  // Resolve queryable environments + token source per mode.
  let validClients: ManagedAuthClient[];
  let validAliases: string[];
  let startupTokens: Map<string, string>;
  if (httpMode) {
    // No server-side tokens; tokens arrive per request. No startup connectivity test.
    validClients = allClients;
    validAliases = ['ALL_ENVIRONMENTS', ...allClients.map((c) => c.alias)];
    startupTokens = new Map();
  } else {
    // stdio: tokens come from the local config/env vars; validate connections at startup.
    startupTokens = buildConfigTokenMap(initConfigs);
    const validation = await validateManagedClients(allClients, startupTokens);
    validClients = validation.validClients;
    validAliases = validation.validAliases;
  }

  // Initialize usage tracking
  const telemetry = createTelemetry();
  await telemetry.trackMcpServerStart();
```

- [ ] **Step 4: Make the factory per-request and build the manager + API clients inside it**

Replace (currently around `src/index.ts:98-102`):

```typescript
  // Factory: creates a new McpServer with all tools registered.
  // Must be called per-request in stateless HTTP mode (the SDK forbids connecting
  // the same McpServer instance to more than one transport).
  const createConfiguredMcpServer = () => {
    const server = new McpServer(
```

with:

```typescript
  // Factory: creates a new McpServer with all tools registered, bound to this caller's tokens.
  // Must be called per-request in stateless HTTP mode (the SDK forbids connecting
  // the same McpServer instance to more than one transport).
  const createConfiguredMcpServer = (tokenMap: Map<string, string>, userKey: string) => {
    // Per-request auth router + API clients.
    const authClientManager = new ManagedAuthClientManager(allClients, validClients, validAliases, tokenMap);
    const metricsClient = new MetricsApiClient(authClientManager);
    const logsClient = new LogsApiClient(authClientManager);
    const eventsClient = new EventsApiClient(authClientManager);
    const entitiesClient = new EntitiesApiClient(authClientManager);
    const problemsClient = new ProblemsApiClient(authClientManager);
    const securityClient = new SecurityApiClient(authClientManager);
    const sloClient = new SloApiClient(authClientManager);

    const server = new McpServer(
```

- [ ] **Step 5: Replace the inline rate-limit logic in the tool wrapper**

Replace (currently around `src/index.ts:221-252`), from the start of `wrappedCb` through the end of the rate-limit block:

```typescript
      const wrappedCb = async (args: any): Promise<CallToolResult> => {
        // Capture starttime for telemetry and rate limiting
        const startTime = Date.now();

        /**
         * Rate Limit: configurable via DT_MCP_RATE_LIMIT_MAX_CALLS and DT_MCP_RATE_LIMIT_WINDOW_MS.
         * Defaults: max 20 requests per 20 seconds.
         */
        const windowStart = startTime - RATE_LIMIT_WINDOW_MS;

        // First, remove all tool calls older than the window
        toolCallTimestamps = toolCallTimestamps.filter((ts) => ts > windowStart);

        // Second, check whether we have reached the limit
        if (toolCallTimestamps.length >= RATE_LIMIT_MAX_CALLS) {
          logger.debug(`Rate-limiting tool execution: ${name}; args: ${JSON.stringify(args)}`);
          return {
            content: [
              {
                type: 'text',
                text: `Rate limit exceeded: Maximum ${RATE_LIMIT_MAX_CALLS} tool calls per ${RATE_LIMIT_WINDOW_MS / 1000} seconds. Please try again later.`,
              },
            ],
            isError: true,
          };
        }

        // Last but not least, record this call
        toolCallTimestamps.push(startTime);
        /** Rate Limit End */

        let toolCallSuccessful = false;
```

with:

```typescript
      const wrappedCb = async (args: any): Promise<CallToolResult> => {
        // Capture starttime for telemetry and rate limiting
        const startTime = Date.now();

        // Per-user (per-token) rate limiting. userKey identifies the caller for this request.
        if (!rateLimiter.tryAcquire(userKey)) {
          logger.debug(`Rate-limiting tool execution: ${name}; args: ${JSON.stringify(args)}`);
          return {
            content: [
              {
                type: 'text',
                text: `Rate limit exceeded: Maximum ${rateLimiter.maxCalls} tool calls per ${rateLimiter.windowMs / 1000} seconds. Please try again later.`,
              },
            ],
            isError: true,
          };
        }

        let toolCallSuccessful = false;
```

- [ ] **Step 6: Rewrite `get_environments_info` to use the caller's token**

Replace the whole `dynatrace_managed_get_environments_info` tool block (currently around `src/index.ts:327-368`), from `tool(` to its closing `);`:

```typescript
    tool(
      'dynatrace_managed_get_environments_info',
      'Get information about all connected Dynatrace Managed clusters and verify the connections and authentication services.',
      {},
      {
        readOnlyHint: true,
      },
      async ({}) => {
        let resp = `Dynatrace Managed Cluster Information - Listing info for ${authClientManager.rawClients.length} environments:\n\n`;

        for (let authClient of authClientManager.rawClients) {
          resp += `- Environment Alias: ${authClient.alias}\n`;
          resp += `- API URL: ${authClient.apiBaseUrl}\n`;
          resp += `- Dashboard URL: ${authClient.dashboardBaseUrl}\n`;
          let clusterVersion;
          let isValidVersion;
          if (authClient.isValid) {
            clusterVersion = await authClient.getClusterVersion();
            isValidVersion = authClient.validateMinimumVersion(clusterVersion);

            resp += `- Version: ${clusterVersion.version}\n`;
            resp += `- Minimum Version Check: ${isValidVersion ? 'PASSED' : 'WARNING - Version may not be fully compatible and may not support all features'}\n`;
            resp += `- Available API Scopes: ${MANAGED_API_SCOPES.join(', ')}\n\n\n`;
          } else {
            resp += `- Error message: ${authClient.validationError}\n`;
          }
        }

        if (initErrors.length > 0) {
          resp += `Issues were found in environment configurations during start up: \n`;
          for (const errorMessage of initErrors) {
            resp += `- ${errorMessage}\n`;
          }
          resp += `\nPlease review all environments connection information. \n`;
        }

        resp += `\n\n\nAll Dynatrace Managed Cluster Environments listed. Environment showing connection errors and environments with "Valid environment" set to "No" are invalid environments.\n\n`;

        return resp;
      },
    );
```

with:

```typescript
    tool(
      'dynatrace_managed_get_environments_info',
      'Get information about all connected Dynatrace Managed clusters and verify the connections and authentication services.',
      {},
      {
        readOnlyHint: true,
      },
      async ({}) => {
        let resp = `Dynatrace Managed Cluster Information - Listing info for ${authClientManager.rawClients.length} environments:\n\n`;

        for (let authClient of authClientManager.rawClients) {
          resp += `- Environment Alias: ${authClient.alias}\n`;
          resp += `- API URL: ${authClient.apiBaseUrl}\n`;
          resp += `- Dashboard URL: ${authClient.dashboardBaseUrl}\n`;

          const token = authClientManager.tokenFor(authClient.alias);
          if (!token) {
            resp += `- Valid Environment: No\n`;
            resp += `- Error message: No token supplied for this environment. Add \`${authClient.alias}=<token>\` to your X-Dynatrace-Tokens header to query it.\n\n`;
            continue;
          }

          try {
            const clusterVersion = await authClient.getClusterVersion(token);
            const isValidVersion = authClient.validateMinimumVersion(clusterVersion);
            resp += `- Valid Environment: Yes\n`;
            resp += `- Version: ${clusterVersion.version}\n`;
            resp += `- Minimum Version Check: ${isValidVersion ? 'PASSED' : 'WARNING - Version may not be fully compatible and may not support all features'}\n`;
            resp += `- Available API Scopes: ${MANAGED_API_SCOPES.join(', ')}\n\n\n`;
          } catch (error: any) {
            resp += `- Valid Environment: No\n`;
            resp += `- Error message: Failed to connect to environment ${authClient.alias}: ${error.message}\n\n`;
          }
        }

        if (initErrors.length > 0) {
          resp += `Issues were found in environment configurations during start up: \n`;
          for (const errorMessage of initErrors) {
            resp += `- ${errorMessage}\n`;
          }
          resp += `\nPlease review all environments connection information. \n`;
        }

        resp += `\n\n\nAll Dynatrace Managed Cluster Environments listed. Environment showing connection errors and environments with "Valid environment" set to "No" are invalid environments.\n\n`;

        return resp;
      },
    );
```

- [ ] **Step 7: Remove the now-duplicate CLI parsing block lower in `main()`**

Replace (currently around `src/index.ts:1153-1169`):

```typescript
  // Parse command line arguments using commander
  const program = new Command();

  program
    .name('dynatrace-managed-mcp')
    .description('Dynatrace Managed Model Context Protocol (MCP) Server')
    .version(getPackageJsonVersion())
    .option('--http', 'enable HTTP server mode instead of stdio')
    .option('--server', 'enable HTTP server mode (alias for --http)')
    .option('-p, --port <number>', 'port for HTTP server', '3000')
    .option('-H, --host <host>', 'host for HTTP server', '127.0.0.1')
    .parse();

  const options = program.opts();
  const httpMode = options.http || options.server;
  const httpPort = parseInt(options.port, 10);
  const host = options.host || '127.0.0.1';
```

with:

```typescript
  // CLI options were parsed at the start of main(); httpMode, httpPort, and host are already set.
```

- [ ] **Step 8: Parse the token header in the HTTP handler**

Replace (currently around `src/index.ts:1184-1185`):

```typescript
      // Create a fresh McpServer per request (stateless HTTP requirement)
      const server = createConfiguredMcpServer();
```

with:

```typescript
      // Per-request tokens come from the X-Dynatrace-Tokens header (alias=token;alias=token).
      const tokenHeader = req.headers['x-dynatrace-tokens'];
      const tokenMap = parseTokenHeader(tokenHeader);
      const userKey = deriveUserKey(Array.isArray(tokenHeader) ? tokenHeader.join(';') : tokenHeader);

      // Create a fresh McpServer per request (stateless HTTP requirement)
      const server = createConfiguredMcpServer(tokenMap, userKey);
```

- [ ] **Step 9: Pass the startup token map in stdio mode**

Replace (currently around `src/index.ts:1246-1247`):

```typescript
    // Default stdio mode
    const server = createConfiguredMcpServer();
```

with:

```typescript
    // Default stdio mode
    const server = createConfiguredMcpServer(startupTokens, 'local');
```

- [ ] **Step 10: Build to verify `src` compiles**

Run: `npm run build`
Expected: PASS — no TypeScript errors. (This confirms the `index.ts` rewiring and the Task 3/4 API line up.)

- [ ] **Step 11: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS — all unit suites green.

- [ ] **Step 12: Manual smoke (optional, no real cluster needed)**

Start the server: `node ./dist/index.js --http --port 8080`
In another shell, send a request without tokens and confirm it responds (the server is up and routing):

Run:
```bash
curl -s -X POST http://127.0.0.1:8080/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'X-Dynatrace-Tokens: prod=dummy' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```
Expected: a JSON-RPC response (either a `result` with the tool list, or a JSON-RPC error about missing `initialize` — either proves the header is accepted and the server is running). Stop the server with Ctrl-C.

- [ ] **Step 13: Commit**

```bash
git add src/index.ts
git commit -m "feat: pass per-user X-Dynatrace-Tokens through to Managed requests in HTTP mode"
```

---

## Task 6: Integration test — header token reaches the request as Authorization

Prove end-to-end (over a real socket, offline) that the supplied token becomes the `Api-Token` Authorization header and that concurrent calls with different tokens don't cross-contaminate.

**Files:**
- Create: `tests/integration/token-passthrough.integration.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/integration/token-passthrough.integration.test.ts`:

```typescript
import { ManagedAuthClient } from '../../src/authentication/managed-auth-client';
import { createServer, Server } from 'node:http';

/**
 * Spins up a local HTTP server that echoes back the Authorization header it received.
 * No Dynatrace credentials or network access required.
 */
describe('Token passthrough (per-call Authorization)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll((done) => {
    server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, auth: req.headers['authorization'] ?? null }));
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => done());
  });

  function newClient(): ManagedAuthClient {
    return new ManagedAuthClient({
      apiBaseUrl: baseUrl,
      dashboardBaseUrl: baseUrl,
      alias: 'local',
      minimum_version: '1.328.0',
    });
  }

  it('sends Api-Token Authorization for the supplied token', async () => {
    const client = newClient();
    const data = await client.makeRequest('/api/v2/metrics', 'tok-123', { pageSize: 1 });
    expect(data.auth).toBe('Api-Token tok-123');
    client.cleanup();
  });

  it('uses the correct token per concurrent call (no cross-contamination)', async () => {
    const client = newClient();
    const [a, b] = await Promise.all([client.makeRequest('/x', 'tokenA'), client.makeRequest('/y', 'tokenB')]);
    expect(a.auth).toBe('Api-Token tokenA');
    expect(b.auth).toBe('Api-Token tokenB');
    client.cleanup();
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npx jest --selectProjects integration --runInBand --forceExit tests/integration/token-passthrough.integration.test.ts`
Expected: PASS (both cases).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/token-passthrough.integration.test.ts
git commit -m "test: verify per-user token reaches request as Api-Token header"
```

---

## Task 7: Documentation

Document the HTTP per-user token model: header format, token-less config, client config example, TLS requirement, and the breaking change.

**Files:**
- Create: `examples/dt-config-http.yaml`
- Create: `examples/mcp-config-http.json`
- Modify: `README.md`
- Modify: `.env.template`
- Modify: `docs/DEVELOPMENT.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add example — token-less HTTP config**

Create `examples/dt-config-http.yaml`:

```yaml
# HTTP mode configuration: NO tokens here.
# Each user supplies their own per-environment tokens at request time via the
# X-Dynatrace-Tokens header (alias=token;alias=token). Only non-secret connection
# details live in this file, so it is safe to commit to version control.
- alias: prod
  apiEndpointUrl: https://prod-api.company.com/
  environmentId: abc-123
  dynatraceUrl: https://prod-dashboard.company.com/

- alias: staging
  apiEndpointUrl: https://staging-api.company.com/
  environmentId: xyz-789
  dynatraceUrl: https://staging-dashboard.company.com/
```

- [ ] **Step 2: Add example — MCP client config with the header**

Create `examples/mcp-config-http.json`:

```json
{
  "mcpServers": {
    "dynatrace-managed": {
      "type": "http",
      "url": "https://mcp.internal.company.com/",
      "headers": {
        "X-Dynatrace-Tokens": "prod=dt0c01.PROD_TOKEN;staging=dt0c01.STAGING_TOKEN"
      }
    }
  }
}
```

- [ ] **Step 3: Document HTTP authentication in `README.md`**

In `README.md`, find the `### Remote mode` heading (around line 210) and insert the following block immediately after its architecture image line:

````markdown
#### HTTP authentication (per-user tokens)

In HTTP mode the server holds **no** Dynatrace API tokens. Each request must carry the caller's
per-environment tokens in a single `X-Dynatrace-Tokens` header, formatted as an `alias=token`
map separated by semicolons:

```
X-Dynatrace-Tokens: prod=dt0c01.AAA;staging=dt0c01.BBB
```

The server uses the caller's token for the environment named by `environment_alias`, so each user
only accesses the data their token allows. A request that targets an environment with no supplied
token is rejected with a message naming the missing alias.

Because tokens are sent in a header, run the HTTP server **behind TLS** (for example, terminate TLS
at a reverse proxy in front of it). The server itself binds to `127.0.0.1` by default and does not
terminate TLS.

Environment config in HTTP mode does not include `apiToken` — only `alias` + URLs, which are
non-secret. See [`examples/dt-config-http.yaml`](./examples/dt-config-http.yaml) and
[`examples/mcp-config-http.json`](./examples/mcp-config-http.json).

> The Configuration Methods described above (server-side `apiToken` values) apply to **stdio /
> local mode**. In HTTP mode, tokens come from the `X-Dynatrace-Tokens` header instead.
````

- [ ] **Step 4: Note HTTP mode in `.env.template`**

In `.env.template`, add this note immediately below the first comment block (after the `## Dynatrace Managed Configuration` header section, before `# DT_CONFIG_FILE=...`):

```
# NOTE ON HTTP MODE (--http): the server uses NO server-side tokens. Each user passes their own
# per-environment tokens in the X-Dynatrace-Tokens request header (alias=token;alias=token), and
# the config below only needs alias + URLs (no apiToken). The settings below apply to stdio mode.
```

- [ ] **Step 5: Document the header in `docs/DEVELOPMENT.md`**

In `docs/DEVELOPMENT.md`, find the `### Running the MCP Server` section (around line 54) and add, after the `node --env-file=.env ./dist/index.js --http` example:

````markdown
When running in HTTP mode, clients authenticate per request with the `X-Dynatrace-Tokens` header
(`alias=token;alias=token`) — the server holds no tokens itself. You can smoke-test locally with:

```bash
curl -s -X POST http://127.0.0.1:3000/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'X-Dynatrace-Tokens: alias-env=dt0c01.YOUR_TOKEN' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```
````

- [ ] **Step 6: Add a CHANGELOG entry**

In `CHANGELOG.md`, under the `## Unreleased Changes` heading, add:

```markdown
- **Breaking change (HTTP mode):** the HTTP server no longer uses server-side API tokens. Each request must supply per-environment tokens via the `X-Dynatrace-Tokens` header (`alias=token;alias=token`); the server authenticates each environment with the caller's token, so each user only accesses data their token allows. In HTTP mode, environment config no longer requires `apiToken` (just `alias` + URLs). Run the HTTP server behind TLS. Rate limiting is now per-token. **stdio / local mode is unchanged** (tokens still come from the local config file / env vars).
```

- [ ] **Step 7: Verify nothing broke and markdown lints**

Run: `npm run test:unit`
Expected: PASS (docs changes don't affect tests).

- [ ] **Step 8: Commit**

```bash
git add README.md .env.template docs/DEVELOPMENT.md CHANGELOG.md \
        examples/dt-config-http.yaml examples/mcp-config-http.json
git commit -m "docs: document HTTP per-user token authentication"
```

---

## Final Verification

- [ ] **Build:** `npm run build` → no errors.
- [ ] **Unit:** `npm run test:unit` → all green.
- [ ] **New integration test:** `npx jest --selectProjects integration --runInBand --forceExit tests/integration/token-passthrough.integration.test.ts` → green.
- [ ] **Manual HTTP smoke** (optional): start `node ./dist/index.js --http --port 8080`; a request with `X-Dynatrace-Tokens: <alias>=<dummy>` returns a JSON-RPC response; `get_environments_info` lists all environments and marks any without a supplied token.

---

## Spec Coverage Map

| Spec requirement | Task |
| --- | --- |
| `X-Dynatrace-Tokens` header parsed to alias→token map (lenient, duplicate=last) | Task 1 |
| Per-user key derivation for rate limiting | Task 1 |
| Per-token rate limiting (replaces global counter) | Task 2, Task 5 (Step 5) |
| Token-less `ManagedAuthClient`; per-call `Authorization`; no default mutation | Task 3 |
| `MissingTokenError` with actionable message | Task 3 |
| Per-request `ManagedAuthClientManager`; `ALL_ENVIRONMENTS` = token-supplied subset | Task 3 |
| Startup helpers: `buildManagedAuthClients`, `validateManagedClients` | Task 3 |
| `apiToken` optional in HTTP mode (config-loader + environment validation) | Task 4 |
| `buildConfigTokenMap` for stdio token source | Task 4 |
| CLI parsed first; mode-aware config load; per-mode token source & validation | Task 5 (Step 3) |
| Per-request factory seeded with tokenMap + userKey; API clients built per request | Task 5 (Step 4) |
| HTTP handler parses header; stdio uses config token map (unified path) | Task 5 (Steps 8–9) |
| `get_environments_info` lists all envs, marks ones without a token, tests with caller token | Task 5 (Step 6) |
| Concurrency isolation (no cross-contamination) verified | Task 3 (unit), Task 6 (integration) |
| Docs: README, .env.template, examples, DEVELOPMENT, CHANGELOG; TLS note; breaking change | Task 7 |
| stdio unchanged for users | Tasks 3–5 (config token map + default `requireToken=true`) |
| No token in logs (redacted parser warnings; headers not logged) | Task 1, Task 5 |
```
