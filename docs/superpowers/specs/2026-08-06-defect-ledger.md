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
| 7   | README L583       | "The MCP server honors system proxy settings" — false; `HTTP_PROXY`/`HTTPS_PROXY` are never read   | Task 4 (`configuration.md`)    | Task 13 forbidden-string guard for `honors system proxy`                    |
| 8   | README L185, L573 | `DT_API_ENDPOINT_URL` named as the `dynatraceUrl` fallback; no such variable exists                | Task 4 (`configuration.md`)    | `scripts/check-docs.mjs` forbidden-string guard                             |
| 9   | README L770       | `DT_MCP_TELEMETRY_APPLICATION_ID` default given as `dynatrace-managed-mcp`; real default is a UUID | Task 4 (`configuration.md`)    | Task 4 review, values confirmed against `telemetry-openkit.ts:38-39`        |
| 10  | README L410       | Recommended HTTP mode for "stateful sessions"; the transport is explicitly stateless               | Task 6 (`setup-remote.md`)     | Task 6 fix round 1                                                          |

Defects introduced during this branch and caught by review, listed for completeness — all fixed before their task closed:

| Location          | Defect                                                                                                                                                            | Caught by     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `api-token.md`    | Claimed a below-minimum cluster "logs a message and continues"; the environment is excluded and its tool calls fail                                               | Task 3 review |
| `setup-local.md`  | Verify step reported false success: the startup banner prints even when every environment fails the live check, and the default `LOG_OUTPUT=file` hid the warning | Task 5 review |
| `setup-remote.md` | Config example used aliases `prod`/`staging` while the smoke test sent `production=`; an exact alias mismatch returns 401 regardless of token validity            | Task 6 review |

## Code and repository defects — open, out of scope for this branch

Ordered by user impact.

### C1. The server tells users the wrong API token scopes

`src/authentication/managed-auth-client.ts:7-16`, `src/tools/environment-tools.ts:6-15`

`MANAGED_API_SCOPES` lists eight legacy scope names: `DataExport`, `ReadConfig`, `ReadSyntheticData`, `ReadLogContent`, `ReadEvents`, `ReadProblems`, `ReadSecurityProblems`, `ReadSLO`.

The scopes actually required by the v2 APIs this server calls are the ten dotted names documented in `docs/api-token.md`. **Only `DataExport` appears in both lists.**

This is not confined to logs. `environment-tools.ts:86` and `:98` inject the list into the MCP **tool response**, so an assistant asked "what scopes do I need?" reports `ReadProblems` when the answer is `problems.read`. `managed-auth-client.ts:212` also prints it on authentication failure — so the one moment a user is actively debugging a scope problem is the moment they are told the wrong scopes.

Fix: reconcile the array with the ten scopes in `docs/api-token.md`, or remove it and link the documentation.

### C2. Standard proxy environment variables are ignored

`src/authentication/managed-auth-client.ts` (`setAxiosProxy`)

`HTTP_PROXY` and `HTTPS_PROXY` are read nowhere in shipped code — they appear only in `src/authentication/__tests__/proxy.test.ts`. The only working mechanism is the per-environment `httpProxyUrl`/`httpsProxyUrl` config fields.

The documentation now states this accurately (defect 7), so nobody is misled any more. But these variables are the ecosystem convention, and self-hosted customers behind corporate egress are this product's core audience. Honouring them as a fallback would be a genuine improvement.

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
