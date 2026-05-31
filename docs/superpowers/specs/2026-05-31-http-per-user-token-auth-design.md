# Per-User Token Passthrough for HTTP Mode — Design

- **Date:** 2026-05-31
- **Status:** Approved (design); ready for implementation planning
- **Scope:** `dynatrace-managed-mcp` HTTP server mode only. stdio/local mode behavior and configuration are unchanged.

## Problem

In HTTP mode the server is unauthenticated. Tokens are loaded once at startup from
`DT_CONFIG_FILE` / `DT_ENVIRONMENT_CONFIGS` and baked into one axios instance per
environment (`src/authentication/managed-auth-client.ts:109-118`). Every HTTP caller
shares those server-side tokens, so anyone who can reach the endpoint can query every
configured environment with full token privileges. There is no way for different users to
present different credentials.

We want a single shared HTTP server where **each user supplies their own Dynatrace API
token(s)** — one per environment — from their AI agent's MCP client config. The server uses
the caller's token for the requested environment, so each user only sees the data their
token is authorized for. A single user often needs **several environments at once** (e.g.
prod + staging), so the server must accept multiple per-environment tokens from one user in
the same session.

## Goals

- In HTTP mode, the server holds **no** Dynatrace tokens. Tokens arrive per request from the
  caller and are used to authenticate against the matching environment.
- A single request can carry multiple tokens (one per environment alias).
- Requests without a valid token for the requested environment are rejected with a clear,
  actionable message.
- Concurrent users with different tokens never cross-contaminate.
- stdio/local mode is **unchanged for users**: tokens stay in the local config file / env
  vars exactly as today.

## Non-Goals

- TLS/transport encryption in the server itself (documentation only — see Security).
- OAuth, token introspection, SSO, or any server-side token storage/management.
- Per-user *tool visibility* (all configured environment aliases remain visible to all
  callers; authorization is enforced at execution time).
- Changing stdio mode configuration or behavior.

## Resolved Decisions

| Decision | Choice |
| --- | --- |
| Per user, how many environments? | Several at once → multi-token scheme required. |
| Token transport | **One bundled header**: `X-Dynatrace-Tokens: alias=token;alias=token`. |
| Relationship to current HTTP behavior | **Replace** it. HTTP mode requires the header; no server-side tokens, no fallback. |
| Plumbing | **Strategy A** — per-request scoped auth; capability layer untouched. |
| Alias visibility | Simple — any *configured* alias is accepted by the param; execution requires a token. |
| Rate limiting | **Per-token**, in scope. |
| TLS | Documentation only. |

## Token Header Format

- Header name: `X-Dynatrace-Tokens` (case-insensitive; Node lowercases to
  `x-dynatrace-tokens`).
- Value: `alias=token` pairs separated by `;`. Example:
  `prod=dt0c01.AAA;staging=dt0c01.BBB`.
- This format is safe with the existing data: aliases are already validated to contain no
  `;` (`src/utils/environment.ts:128`), and Dynatrace API tokens contain no `;` or `=`.
- Parsing is **lenient**: surrounding whitespace is trimmed, malformed pairs (no `=`) are
  skipped with a redacted warning, and a duplicate alias takes the last value. A missing
  token for a requested alias surfaces later as a per-alias execution error (below), not as a
  parse failure.

## Architecture (Strategy A)

The token moves from construction-time (shared) to request-time (per user) by splitting the
auth layer into a **startup registry** (token-less, shared) and a **per-request manager**
(carries the request's tokens).

- **Startup registry (built once):** one `ManagedAuthClient` per configured environment,
  holding the environment's URLs, proxy config, and a **shared axios instance with no
  `Authorization` baked in**. Also produces the `validAliases` list from the configured
  environments.
- **`ManagedAuthClient` becomes token-stateless:** `makeRequest`, `validateConnection`, and
  `getClusterVersion` each take a `token` argument and set
  `Authorization: Api-Token <token>` **per call** (in the per-request axios config, never
  mutating `httpClient.defaults`). This makes the shared client instances safe to use
  concurrently across users.
- **`ManagedAuthClientManager` becomes per-request and cheap to construct:** it references
  the shared `ManagedAuthClient[]` plus the request's `tokenMap: Map<alias, token>`. Its
  public surface (`makeRequests`, `getBaseUrl`, `validAliases`, `clients`, `rawClients`,
  `MINIMUM_VERSION`) is preserved, so the seven capability modules that consume it
  **do not change**. `makeRequests` resolves each alias's token from `tokenMap`; a missing
  token throws a typed `MissingTokenError(alias)`.
- **The per-request factory wires it together:** `createConfiguredMcpServer(tokenMap)`
  (`src/index.ts:101`) constructs the per-request `ManagedAuthClientManager` and the API
  clients from it. Because the factory already runs once per HTTP request in stateless mode,
  the tokens are naturally scoped to that request; the per-request objects are thin wrappers
  (the expensive axios instances live in the shared registry).

### Token source per mode (unified request path)

Both modes drive the same request path; only the **source** of the `tokenMap` differs:

- **HTTP:** the HTTP handler parses `X-Dynatrace-Tokens` from `req.headers` into the
  `tokenMap` per request, then calls `createConfiguredMcpServer(tokenMap)`.
- **stdio:** a `tokenMap` is built **once** from the config file / env-var tokens at startup
  and passed to the single `createConfiguredMcpServer(tokenMap)` call. Users configure tokens
  exactly as today.

### Startup validation per mode

- **stdio:** startup connection validation (`isConfigured`) runs with the config tokenMap, as
  today — invalid environments are reported and excluded from `validAliases`. No UX change.
- **HTTP:** no startup token exists, so startup validation is skipped; `validAliases` is the
  full set of configured aliases. Connectivity/auth is reported per request by
  `get_environments_info` using the caller's token.

## Request Data Flow (HTTP)

```
Claude Code
  └─ POST /mcp  (header: X-Dynatrace-Tokens: prod=…;staging=…)
       └─ HTTP handler: parse header → Map{prod, staging}; derive userKey (rate limit)
            └─ createConfiguredMcpServer(tokenMap) → ManagedAuthClientManager(shared, tokenMap)
                 └─ per-request API clients (metrics, logs, …)
                      └─ tool call (environment_alias="prod")
                           └─ makeRequests: token = tokenMap.get("prod")
                                └─ axios GET <prod url>  Authorization: Api-Token <prod token>
```

## Config Schema Changes

- **HTTP mode:** `apiToken` becomes **optional and ignored**. An environment is defined by
  its `alias` + URLs (+ optional proxy) — all non-secret and committable:

  ```yaml
  - alias: prod
    apiEndpointUrl: https://prod-api.company.com/
    environmentId: abc-123
  - alias: staging
    apiEndpointUrl: https://staging-api.company.com/
    environmentId: xyz-789
  ```

- **stdio mode:** `apiToken` remains **required** (unchanged). Config validation
  (`src/utils/config-loader.ts:137`, `src/utils/environment.ts:106`) becomes mode-aware: in
  HTTP mode `apiToken` is dropped from the required-keys check.

## Error Handling & Edge Cases

- **No token for a requested alias:** the tool returns `isError: true` with:
  *"No token supplied for environment 'prod'. Add `prod=<token>` to your X-Dynatrace-Tokens
  header."*
- **`ALL_ENVIRONMENTS`:** operates only on the environments the caller supplied tokens for,
  and notes which configured environments were skipped (you cannot query what you cannot
  authenticate).
- **`get_environments_info`:** lists **all** configured environments so users can discover
  what exists and request access; tests connectivity with the caller's token where supplied,
  and marks environments for which no token was provided.
- **`environment_alias` validation:** unchanged — any configured alias passes the param
  refine (`src/index.ts:293`); authorization is enforced at execution time.

## Per-Token Rate Limiting

Today's limiter is a single module-level counter shared across all callers
(`src/index.ts:45`), so one user can starve everyone.

- Replace it with a module-level `Map<userKey, number[]>` (timestamps per user), reusing the
  existing window/limit config (`src/utils/rate-limit.ts`).
- `userKey`:
  - **HTTP:** a SHA-256 hex of the raw `X-Dynatrace-Tokens` header value (stable per user,
    avoids storing raw tokens in the limiter).
  - **stdio:** a constant key (single user) → identical to today's behavior.
- `userKey` is derived per request (HTTP: in the handler from the raw header value; stdio: the
  constant key) and reaches the existing tool wrapper via the per-request factory closure; the
  wrapper checks/records against that key. Buckets are pruned to the window on each call, and
  empty buckets are dropped to bound memory.

## Security / Non-Functional

- **TLS:** tokens travel in a header, so a real multi-user deployment **must** sit behind TLS.
  The server binds `127.0.0.1` by default and provides no TLS itself; terminate TLS at a
  reverse proxy. **Documented**, not implemented.
- **No token leakage:** tokens are never logged (the parsed map is redacted; existing debug
  logging at `src/index.ts:255` logs tool `args`, not headers — keep it that way), never sent
  to telemetry (OpenKit), and never placed in tool arguments or responses (they live only in
  headers and the per-request axios call).
- **Concurrency:** `Authorization` is set per axios call, never on shared instance defaults,
  so simultaneous users with different tokens are isolated.

## Documentation Updates (in scope)

- **`README.md`:** expand "Remote mode" (~line 210) and "Authentication" (~line 569) to
  describe HTTP per-user token auth; add an HTTP-mode config example (no tokens), the
  `X-Dynatrace-Tokens` header format, a Claude Code client-config example, and the TLS
  requirement. Clarify that the existing Configuration Methods apply to stdio/local mode.
- **`.env.template`:** note that HTTP mode uses no server-side tokens; tokens arrive via the
  header.
- **`examples/`:** add an HTTP-mode config example (environments without tokens) and an MCP
  client-config snippet that sets the `X-Dynatrace-Tokens` header.
- **`docs/DEVELOPMENT.md`:** update "Running the MCP Server" (~line 54) with HTTP header usage
  and a `curl` example for local testing.
- **`CHANGELOG.md`:** add an entry under "Unreleased Changes" flagging the **breaking change**
  to HTTP mode (header now required; server-side tokens no longer used in HTTP mode).

## Testing Strategy

Framework: Jest, with `unit` and `integration` projects (`package.json`).

- **Unit**
  - Header parser: well-formed, empty, whitespace, malformed pair (no `=`), duplicate alias
    (last wins).
  - `userKey` hashing: stable for the same header value, differs for different token bundles.
  - `ManagedAuthClientManager.makeRequests`: resolves the token from the map; throws
    `MissingTokenError` when absent; `ALL_ENVIRONMENTS` expands to only token-supplied aliases.
  - `ManagedAuthClient.makeRequest`: sets per-call `Authorization`; does **not** mutate axios
    defaults; two calls with different tokens send different headers.
  - Per-token rate limiter: independent buckets; one key exhausting its limit does not block
    another key.
- **Integration** (extend `tests/integration`)
  - HTTP request with `X-Dynatrace-Tokens` → the correct token reaches the mocked Dynatrace
    endpoint as `Authorization: Api-Token …`.
  - Two concurrent HTTP requests with different tokens reach their respective environments
    with no cross-contamination.
  - Missing-token request → tool returns `isError` with guidance.
  - stdio regression: existing stdio integration tests still pass unchanged.
- **Existing tests to update**
  - `src/authentication/__tests__/managed-auth-client.test.ts` (token-stateless client +
    manager constructor changes).
  - `src/authentication/__tests__/proxy.test.ts` (proxy still applied per call).
  - `src/utils/__tests__/environment.test.ts` / `config-loader.test.ts` (`apiToken` optional in
    HTTP mode).

## Invariants

- stdio mode: identical config (file/env vars), identical behavior, identical startup
  validation — an internal refactor only.
- The seven capability modules (`src/capabilities/*-api.ts`) and their tests are unchanged.
- No token appears in logs, telemetry, or model context.
