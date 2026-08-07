# Defect ledger — documentation restructure

Date: 2026-08-06
Branch: `docs/restructure-documentation`
Spec: [2026-08-06-readme-restructure-design.md](2026-08-06-readme-restructure-design.md)
Plan: [../plans/2026-08-06-documentation-restructure.md](../plans/2026-08-06-documentation-restructure.md)

Every defect found while grounding the documentation against `src/`. Two classes, tracked separately because they have different owners and different fates.

- **Documentation defects** are fixed by this branch. Each names the task that fixes it and how the fix is verified.
- **Code and repository defects** are **out of scope** for this branch (the spec's non-goals forbid changes to `src/`). They are recorded here so they are not lost, because they are real and several are user-facing.

## Documentation defects — fixed in this branch

| #   | Legacy location   | Defect                                                                                             | Fixed by                       | Verified by                                                                 |
| --- | ----------------- | -------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| 1   | README L425-427   | Told users to run `@dynatrace-oss/dynatrace-mcp-server` — the **SaaS** package                     | Task 6 (`setup-remote.md`)     | `scripts/check-docs.mjs` forbidden-string guard                             |
| 2   | README L748       | Code block indented inside a fence; rendered broken                                                | Task 12 (`troubleshooting.md`) | markdownlint `MD046`/`MD031`                                                |
| 3   | README L378       | `gemini extensions install <repo>` cannot work — repo ships no `gemini-extension.json`             | Task 9 (`other-clients.md`)    | `scripts/check-docs.mjs` forbidden-string guard                             |
| 4   | README L38        | Advertised Cursor, Windsurf, ChatGPT, Copilot with no instructions for any of them                 | Task 9 (`other-clients.md`)    | Task 9 per-client presence check                                            |
| 5   | absent            | Node `engines` constraint `>=26.5.1 <27` documented nowhere                                        | Task 2 (`README.md`)           | `scripts/check-docs.mjs` engines check                                      |
| 6   | absent            | Signed multi-arch image `ghcr.io/dynatrace-oss/dynatrace-managed-mcp` undocumented                 | Task 6 (`setup-remote.md`)     | Task 6 review, image name confirmed against `.github/workflows/release.yml` |
| 7   | README L583       | "The MCP server honors system proxy settings" — vague and unqualified; see note below              | Task 4 (`configuration.md`)    | Task 13 forbidden-string guard for `honors system proxy`                    |
| 8   | README L185, L573 | `DT_API_ENDPOINT_URL` named as the `dynatraceUrl` fallback; no such variable exists                | Task 4 (`configuration.md`)    | `scripts/check-docs.mjs` forbidden-string guard                             |
| 9   | README L770       | `DT_MCP_TELEMETRY_APPLICATION_ID` default given as `dynatrace-managed-mcp`; real default is a UUID | Task 4 (`configuration.md`)    | Task 4 review, values confirmed against `telemetry-openkit.ts:38-39`        |
| 10  | README L410       | Recommended HTTP mode for "stateful sessions"; the transport is explicitly stateless               | Task 6 (`setup-remote.md`)     | Task 6 fix round 1                                                          |

### Amendment to defect 7: the replacement text was itself false

The original fix for defect 7 replaced the README's vague, unqualified "honors system proxy settings" with a different, equally false claim: that the per-environment `httpProxyUrl` / `httpsProxyUrl` fields are "the only mechanism the server supports" and that `HTTP_PROXY` / `HTTPS_PROXY` are "not read by this server."

They are read — transitively. `src/authentication/managed-auth-client.ts` makes five outbound calls through its shared axios instance. Only one of them (`makeRequest`, `:171-183`, used for tool/data requests) passes an explicit `proxy` option built from `httpProxyUrl` / `httpsProxyUrl` (`setAxiosProxy`, constructed at `:60`). The other four — `validateAPIToken` (`:85`), `validateConnection` (`:100`, with fallback `:111`), and `getClusterVersion` (`:125`) — pass no `proxy` option at all, so axios (`node_modules/axios/dist/node/axios.cjs`, `setProxy`, ~`:2984`) falls through to `proxy-from-env`, which reads `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` from the process environment. Confirmed by reading both files directly; axios version `1.16.0` (`node_modules/axios/package.json:3`).

The accurate description — now in `docs/configuration.md`'s `## Proxy` section — is that the server has two uncoordinated proxy mechanisms, split by which code path a given request takes rather than by design: tool/data requests prefer the per-environment fields and fall back to the environment variables; startup validation, the cluster-version check, and the HTTP-mode token lookup always use the environment variables and never the per-environment fields; `NO_PROXY` applies only on the environment-variable path; and setting both per-environment fields configures neither, which means falling back to the environment variables, not going proxy-less.

Defects introduced during this branch and caught by review, listed for completeness — all fixed before their task closed:

| Location                 | Defect                                                                                                                                                                                                                    | Caught by      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `api-token.md`           | Claimed a below-minimum cluster "logs a message and continues"; the environment is excluded and its tool calls fail                                                                                                       | Task 3 review  |
| `setup-local.md`         | Verify step reported false success: the startup banner prints even when every environment fails the live check, and the default `LOG_OUTPUT=file` hid the warning                                                         | Task 5 review  |
| `setup-remote.md`        | Config example used aliases `prod`/`staging` while the smoke test sent `production=`; an exact alias mismatch returns 401 regardless of token validity                                                                    | Task 6 review  |
| `clients/claude-code.md` | Local registration command's unquoted `~` (`-e DT_CONFIG_FILE=~/...`) is shell-expanded before `claude` sees it, baking the author's own home directory into a committed `.mcp.json` instead of the portable `~/...` path | Task 7 review  |
| `clients/copilot-cli.md` | Claimed the `mcp-compat.ts`/`enableJsonResponse` fixes shipped in `1.0.1`; they actually shipped in `0.5.7` — `mcp-compat.ts` was only extracted, not introduced, in the 1.0.x refactor                                   | Task 8 review  |
| `troubleshooting.md`     | Asserted a fixed client-side error string `Mcp error: -32002: connection closed`; no such code is defined in the vendored MCP SDK, and the wording varies per client's own bundled SDK                                    | Task 12 review |

## Code and repository defects — open, out of scope for this branch

Ordered by user impact.

### C1. The server tells users the wrong API token scopes

`src/authentication/managed-auth-client.ts:7-16`, `src/tools/environment-tools.ts:6-15`

`MANAGED_API_SCOPES` lists eight legacy scope names: `DataExport`, `ReadConfig`, `ReadSyntheticData`, `ReadLogContent`, `ReadEvents`, `ReadProblems`, `ReadSecurityProblems`, `ReadSLO`.

The scopes actually required by the v2 APIs this server calls are the eight dotted names documented in `docs/api-token.md` (revised during the 2026-08-06 fix wave: `auditLogs.read` and `networkZones.read` were dropped from that page — no code path calls an audit-log or network-zone endpoint). **Only `DataExport` appears in both lists.**

This is not confined to logs. `environment-tools.ts:86` and `:98` inject the list into the MCP **tool response**, so an assistant asked "what scopes do I need?" reports `ReadProblems` when the answer is `problems.read`. `managed-auth-client.ts:212` also prints it on authentication failure — so the one moment a user is actively debugging a scope problem is the moment they are told the wrong scopes.

Fix: reconcile the array with the scopes in `docs/api-token.md`, or remove it and link the documentation.

### C2. The server has two uncoordinated proxy mechanisms

`src/authentication/managed-auth-client.ts`

`HTTP_PROXY` / `HTTPS_PROXY` are not read directly by name anywhere in `src/` (`process.env.HTTP_PROXY` / `HTTPS_PROXY` appear only in `src/authentication/__tests__/proxy.test.ts`), but they **are** read transitively, on every request that doesn't carry an explicit per-environment proxy: the shared axios client falls through to the `proxy-from-env` package, which reads them (and `NO_PROXY`) straight from the process environment. Of the five outbound calls in `managed-auth-client.ts`, only `makeRequest` (`:171-183`, tool/data requests) passes an explicit `proxy` built from `httpProxyUrl` / `httpsProxyUrl` (`setAxiosProxy`, `:60`); `validateAPIToken` (`:85`), `validateConnection` (`:100`/`:111`), and `getClusterVersion` (`:125`) do not, so they always take the environment-variable path — see C10.

The real issue is not that the environment variables are ignored — it's that the server has **two separate proxy mechanisms that don't coordinate**, split by which call site happens to pass a `proxy` option rather than by any coherent design: one governs tool/data requests only (and prefers the per-environment field), the other governs everything else unconditionally. A customer whose whole proxy answer is "I set `httpProxyUrl`" is only half covered. The documentation (`docs/configuration.md#proxy`) now describes this split accurately, but describing a quirk isn't the same as fixing it.

Fix: pick one coherent proxy model — e.g. resolve a single effective proxy per environment (per-environment field, falling back to the environment variables) and pass it explicitly to every outbound call, including the four that currently skip it.

### C3. Setting both proxy fields silently disables the proxy

`src/authentication/managed-auth-client.ts:332-336`

When both `httpProxyUrl` and `httpsProxyUrl` are set on one environment, `setAxiosProxy` logs an error and returns `undefined` — so **neither** proxy is configured and requests go direct. An administrator filling in both "to be safe" gets the opposite of what they intended, and the only signal is a log line.

Fix: fail fast at startup, or pick one deterministically and warn.

### C4. `server.json` misrepresents the server to the MCP registry

`server.json`

`DT_ENVIRONMENT_CONFIGS` is marked `"isRequired": true` and `DT_CONFIG_FILE` is not listed at all. Now that the configuration file is the documented and recommended method, the registry metadata contradicts the documentation. It also omits `DT_MCP_MAX_BODY_SIZE` and `DT_MCP_TOKEN_VALIDATION_TTL_MS`.

Fix: add `DT_CONFIG_FILE`, mark neither as unconditionally required (either satisfies the server), and add the two missing variables.

### C5. `prettier --check` fails on `main`

`src/capabilities/__tests__/events-api.test.ts`

The file fails `prettier --check` on `main`, independently of this branch. `npm run prettier` is a gate in `.github/workflows/release.yml`, so this can fail a release. Deliberately not fixed here to keep the documentation diff clean — it wants its own one-line commit.

Reproduce: `git show main:src/capabilities/__tests__/events-api.test.ts` and run `prettier --check` on it.

### C6. Unreachable branch in the live-cluster check

`src/authentication/managed-auth-client.ts:242-247`

`validateManagedClients` skips environments with no token (`if (!token) { … continue; }`), but in stdio mode `validateEnvironments` runs with `requireToken=true`, so a missing token is already a structural error that exits the process upstream. In HTTP mode `validateManagedClients` is never called. The branch is therefore dead through both real code paths.

Cosmetic, listed only so the next reader of that function does not assume it is load-bearing.

### C7. `docs/DEVELOPMENT.md` has a wrong error code, stale example, and the old indented-code-block style

`docs/DEVELOPMENT.md:189-199`

The "Development Troubleshooting" section asserts `Mcp error: -32002: connection closed: initialize response`. No such code exists in the vendored MCP SDK — it defines `ConnectionClosed = -32000` and `RequestTimeout = -32001` (`node_modules/@modelcontextprotocol/sdk/dist/*/types.d.ts:259-260`), and each client bundles its own SDK, so there is no single fixed code or wording to assert here (this is exactly the correction `troubleshooting.md`'s equivalent entry already received — see the "introduced during this branch" table above). The same section also still renders its two commands as indented code blocks rather than fenced ones — the same rendering defect fixed everywhere else as documentation defect 2 — and one example reads `npx /path/to/repos/dynatrace-oss/dynatrace-manage-mcp/dist/index.js`, missing the `d` in `managed`, and using `npx` where `node` is what actually runs a local file path. The design's non-goals keep `docs/DEVELOPMENT.md`'s content out of scope for this branch (only its cross-links were to change), so this is recorded rather than fixed here.

### C8. The server's own error message points at a dead anchor

`src/utils/environment.ts:84`

When neither `DT_CONFIG_FILE` nor `DT_ENVIRONMENT_CONFIGS` is set, the thrown error tells the user `See documentation: https://github.com/dynatrace-oss/dynatrace-managed-mcp#configuration`. This branch deleted the `#configuration` heading from `README.md` that anchor pointed to; the equivalent content now lives at `docs/configuration.md`. Out of scope for `src/`, but caused by this branch — the next `src/` change that touches this error string should point it at `docs/configuration.md` instead.

### C9. `${VAR}` interpolation in the config **path** silently does nothing

`src/utils/config-loader.ts:114`

`resolvePath`'s path-interpolation regex is `filePath.replace(/\$\{(w+)}/g, ...)` — a bare `w`, not `\w+`. It therefore matches only the literal three characters `${w}` and never matches a real variable name, so any `${VAR_NAME}` written inside `DT_CONFIG_FILE` itself (as opposed to inside the file's _content_, which uses a separate, correct regex in `config-loader.ts:93`) is left untouched. Verified by reading the regex directly; not otherwise exercised by a test. The documentation is not misled by this — `docs/configuration.md` only ever documents `${VAR}` interpolation of file **content**, never of the path — so this is recorded for the code owner, not a documentation fix.

### C10. A customer whose only egress is the per-environment proxy cannot pass startup validation

`src/authentication/managed-auth-client.ts:75`, `:90`, `:101`, `:115` (line numbers as cited when this defect was recorded; current file has them at `:85`, `:100`, `:111`, `:125` respectively — `validateAPIToken`, `validateConnection`'s primary call, its fallback call, and `getClusterVersion`)

None of `validateAPIToken`, `validateConnection`, or `getClusterVersion` pass the per-environment proxy (`this.proxy`, built from `httpProxyUrl` / `httpsProxyUrl`) to the HTTP client — only `makeRequest` does (`:171-183`, the one used for tool/data requests, after this client is already considered "valid"). So a customer whose corporate egress policy only permits traffic through the proxy named in `httpProxyUrl` / `httpsProxyUrl`, and who has not separately set `HTTP_PROXY` / `HTTPS_PROXY` in the server's process environment, cannot reach the cluster for any of: the live-cluster check in `isConfigured` (stdio startup validation), the cluster-version check, or — in HTTP mode — the per-request token lookup. The per-environment proxy field is doing nothing for exactly the requests that decide whether the environment is usable at all.

Symptom: in stdio mode the environment is silently dropped at startup (see documentation defect D1 and the "success line prints but tool calls fail anyway" failure mode); in HTTP mode every request against that environment returns `401 Unauthorized`. In both cases the per-environment proxy is configured correctly and is not the cause.

This is a code defect — the fix is to make the same proxy resolution used by `makeRequest` apply to all five outbound call sites, or to have all of them share one resolved proxy config. Out of scope for this documentation branch; `docs/configuration.md#proxy` and `docs/troubleshooting.md` now describe the resulting behavior and the workaround (also set `HTTP_PROXY` / `HTTPS_PROXY`) so customers aren't misled while this is open.

## Documentation defect found by the final re-review — fixed

### D1. Two statements over-generalise when startup errors reach the terminal

`docs/troubleshooting.md:44` and `docs/setup-remote.md:190`

Both say a startup error is invisible without `LOG_OUTPUT=stderr-all`. That is true only for errors thrown by `src/utils/config-loader.ts` (bad path, parse failure, unsupported extension), which reach the terminal solely through `main().catch` → `logErrorObject` → `logger.error`.

It is **false** for the two validation-stage exits, which call `console.error` **unconditionally** alongside `logger.error` (`src/index.ts:117-129`): `Failed to get managed environments configurations:` and `No valid environments found, stopping.` print regardless of `LOG_OUTPUT`.

`docs/troubleshooting.md`'s own dedicated section for the first of those strings already draws the distinction correctly, so the branch contradicts itself. No reader following the guide is misled operationally — every documented invocation already sets `LOG_OUTPUT=stderr-all` — which is why the final re-review rated it non-blocking.

Fixed in `a545b41`. Both pages now distinguish the config-loader errors (logger-only, so they need `LOG_OUTPUT=stderr-all`) from the two validation-stage exits, which call `console.error` unconditionally and print whatever `LOG_OUTPUT` is set to. Verified: `src/utils/environment.ts` and `src/utils/config-loader.ts` contain no `console.*` calls.

## Further repository follow-up (not scope-relevant to this branch)

`README.md`'s licence badge and closing section both say Apache 2.0, matching `LICENSE`. `package.json:57` says `"license": "MIT"`. One of the two is wrong; whichever it is should be corrected in a follow-up outside this documentation branch.
