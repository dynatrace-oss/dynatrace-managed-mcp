# Design: Restructure the Dynatrace Managed MCP documentation

Date: 2026-08-06
Status: Approved

## Problem

The README has grown to 778 lines and customers cannot work out how to set the server up.

The failure is structural, not cosmetic:

1. **Configuration is documented five times, in five places.** "Configuration Methods" (L41), "Configuration Priority" (L154), "Configuration Fields" (L162), "Configuration" (L297 — actually _client_ setup), and "Environment Variables → Multienvironment Config Fields" (L568). The last is a near-verbatim duplicate of L162, and the two copies have already drifted: L568 marks fields `required`, L162 does not.
2. **The Quickstart contains no steps.** It says "please refer to the configuration section below."
3. **Remote (HTTP) mode is split across three distant sections.** The auth contract is documented under _Architecture_ (L214), the CLI flags under _Configuration_ (L406), the token scopes under _Authentication_ (L613). There is no end-to-end path, and nothing about how to actually deploy it.
4. **Prerequisites are missing or buried.** The Node `engines` constraint (`>=26.5.1 <27`) appears nowhere. The minimum cluster version is at L202. Token creation lands ~600 lines after the first snippet that requires a token.
5. **Every client snippet uses the method the README itself disrecommends.** All snippets use escaped-JSON `DT_ENVIRONMENT_CONFIGS` while L45 declares the config file "Recommended" and L148 calls the JSON string "Not ideal for local development."
6. **Advertised clients have no instructions.** L38 claims Cursor, Kiro, Windsurf, ChatGPT and GitHub Copilot support; only Kiro has instructions. Claude Code is absent entirely.
7. **Rules/steering guidance is duplicated** (L446 and L665) across ~90 lines of templates.

## Goals

- A first-time customer reaches a working server for their client in about five minutes.
- Local mode and remote mode each have one complete, self-contained path.
- Claude Code and GitHub Copilot are first-class, alongside VS Code and Claude Desktop.
- Every documented fact has exactly one owner file, so the duplication cannot re-form.
- All eight known factual defects are corrected.

## Non-goals

- No documentation website, wiki, or new build pipeline. Docs stay in-repo, versioned with the code.
- No changes to `src/`. Where documentation and code disagree, this project corrects the _documentation_; code defects are recorded below for separate follow-up.
- `examples/README.md` (the prompt cookbook) and `docs/DEVELOPMENT.md` keep their current content. Only their cross-links change.

## Decisions

| Decision                  | Choice                                                                                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs home                 | README landing page + task-oriented guides under `docs/`. In-repo, no new tooling.                                                                                                                                          |
| Client coverage           | Full guides for Claude Code, VS Code + Copilot, Copilot CLI, Claude Desktop. Cursor, Windsurf, Kiro, Gemini CLI, ChatGPT share one table page.                                                                              |
| Recommended config method | A YAML config file referenced by `DT_CONFIG_FILE`, used in **every** setup snippet. `${VAR}` interpolation shown as the commit-safe variant. `DT_ENVIRONMENT_CONFIGS` demoted to the reference page plus Docker/Kubernetes. |
| Remote-mode depth         | Full deployment guide: GHCR image, `docker run`, compose, Kubernetes, TLS reverse proxy, curl smoke test, limits.                                                                                                           |
| README scope              | Keep the hook (pitch, SaaS callout, capabilities, prerequisites, quickstart, link table). Move use cases, architecture diagrams and the hybrid section into `docs/`. Target ~170 lines.                                     |
| Quickstart shape          | Two client-independent steps done concretely (token, config file), then a four-row table branching to the client guides.                                                                                                    |
| Execution                 | Migrate, then verify: a line-by-line map of all 778 lines (move / rewrite / delete), then verify each snippet against the source.                                                                                           |
| Verification              | Structural checks plus local HTTP-mode checks. No live cluster; no use of local credential files.                                                                                                                           |

VS Code and GitHub Copilot share one page because in VS Code, Copilot **is** the MCP client: servers are declared in `.vscode/mcp.json` and consumed by Copilot Chat agent mode. Copilot CLI gets its own page because its registration and its schema constraints genuinely differ.

## Documentation architecture

Every fact has exactly one owner. Each file carries an explicit exclusion so a future contributor knows where a new fact belongs.

| File                              | Owns (single source of truth)                                                                                                                                                            | Does **not** contain                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `README.md` (~170 lines)          | Pitch, SaaS-vs-Managed callout, capability bullets, prerequisites, five-minute quickstart, documentation link table, support/licence, three-line telemetry summary                       | Client snippets beyond the branch table; env-var reference; architecture diagrams |
| `docs/README.md` (~30 lines)      | Index table of every guide — what a reader sees when they click into `docs/`                                                                                                             | Any prose of its own                                                              |
| `docs/api-token.md`               | **The only** list of required scopes; how to create a Managed API token; minimum cluster version                                                                                         | MCP client configuration                                                          |
| `docs/setup-local.md`             | stdio hub: end-to-end local flow, `npx` / pinned-version / cloned-repo / Docker-stdio variants, standalone verification, stdio logging, restart-after-config-change                      | Per-client snippets; the full env-var table                                       |
| `docs/setup-remote.md`            | HTTP hub: `--http`/`--server`/`--port`/`--host`, the `X-Dynatrace-Tokens` contract, GHCR image, `docker run`, compose, Kubernetes, TLS in front, curl smoke test, header and body limits | Token scopes; per-client snippets                                                 |
| `docs/clients/claude-code.md`     | `claude mcp add` and `.mcp.json`, local and remote variants, where Claude Code logs live                                                                                                 | Token creation; config schema                                                     |
| `docs/clients/vs-code-copilot.md` | `.vscode/mcp.json`, agent mode, `envFile` vs `env`, the `${workspaceFolder}` caveat, `LOG_OUTPUT=stderr-all` tip                                                                         | As above                                                                          |
| `docs/clients/copilot-cli.md`     | Copilot CLI registration plus the schema/transport caveats `src/utils/mcp-compat.ts` exists for                                                                                          | As above                                                                          |
| `docs/clients/claude-desktop.md`  | `claude_desktop_config.json` per-OS paths                                                                                                                                                | As above                                                                          |
| `docs/clients/other-clients.md`   | Cursor, Windsurf, Kiro, Gemini CLI, ChatGPT — config path plus snippet per client                                                                                                        | As above                                                                          |
| `docs/configuration.md`           | **The only** env-var table and config-file schema: `DT_CONFIG_FILE`, `DT_ENVIRONMENT_CONFIGS`, priority, per-field docs, proxy fields, logging matrix, rate limits, telemetry            | Setup steps                                                                       |
| `docs/multi-environment.md`       | Alias strategy, rule-file and steering templates, per-environment proxy usage                                                                                                            | Hybrid SaaS + Managed                                                             |
| `docs/hybrid-saas-managed.md`     | Running alongside the SaaS MCP, migration-cutover scenario, its two steering templates                                                                                                   | Multi-Managed-environment guidance                                                |
| `docs/troubleshooting.md`         | Symptom → cause → fix, keyed to the error strings the server actually emits                                                                                                              | Anything that is not a failure mode                                               |
| `docs/overview.md`                | Use cases, both architecture diagrams, SaaS-vs-Managed differences, performance guidance                                                                                                 | Setup instructions                                                                |
| `docs/DEVELOPMENT.md`             | Unchanged, except cross-links updated to the new files                                                                                                                                   | —                                                                                 |
| `examples/README.md`              | Unchanged — the prompt cookbook                                                                                                                                                          | —                                                                                 |

Two deliberate calls:

- **`docs/api-token.md` is its own file, not a section.** The scopes list is needed by the README quickstart, both mode guides, and troubleshooting. Its current position (L613, _after_ every snippet that uses a token) is a direct cause of the confusion being reported.
- **`docs/overview.md` is the one file nobody needs to read to succeed.** That is intentional: it preserves the marketing surface without putting it on the critical path.

## File contents

### `README.md`

```text
badges
what it is (one paragraph)
> Using Dynatrace SaaS? → dynatrace-mcp        (keep as a callout)
> Community-supported → GitHub Issues
Capabilities (7 bullets)
Prerequisites
  - Node >= 26.5.1 < 27 (hard engines constraint; npm fails with EBADENGINE)
  - Dynatrace Managed >= 1.328.0
  - Network access to the cluster API endpoint (often port 9999)
Quickstart
  1. Create an API token with the required scopes   → docs/api-token.md
  2. Create ~/.dynatrace/managed-mcp.yaml           (inline YAML; restrict
                                                     permissions — chmod 600
                                                     on macOS/Linux)
  3. Add the server to your client                  → 4-row branch table
                                                      + other-clients link
  4. Ask "Ask Dynatrace to list problems"           → what success looks like
     Not working? → docs/troubleshooting.md
Documentation (link table over all docs/ guides)
Telemetry (3 lines + link)
Support / contributing / licence
```

Step 1 is a link rather than an inline scope list. Creating a token means leaving the README for the Dynatrace UI regardless, so the hop costs nothing and the scopes stay single-sourced.

The config path is written as `~/.dynatrace/managed-mcp.yaml` consistently across every page, including the client snippets. This is safe in all clients because the **server** expands `~` itself (`src/utils/config-loader.ts:124`, falling back through `HOME` then `USERPROFILE`), so it does not depend on the client expanding it. `docs/configuration.md` documents that, plus the relative-path caveat: relative paths resolve against the client's working directory, which is why an absolute or `~` path is recommended.

### `docs/setup-local.md`

Opens with _how it works_, because one behaviour explains most local-mode support questions: in stdio mode the server validates every configured environment against the live cluster at startup (`validateManagedClients`) and exits `1` if none are valid. Local misconfiguration therefore fails loudly at launch — that is the signal to teach.

Then: configuration (minimal, then multi-environment) → how to run it (`npx@latest`, pinned version, cloned repo, Docker-stdio) → register with your client (links out) → verify standalone, expecting `Dynatrace Managed MCP Server running on stdio` **on stderr** → stdio logging (`stderr-all` vs `file`, and the warning the server prints when `LOG_OUTPUT` is set to a stdout variant) → configuration changes require a client restart.

### `docs/setup-remote.md`

```text
when to use remote mode (one shared server, per-user tokens)
how auth works: X-Dynatrace-Tokens: alias=token;alias=token
1. build the environment config  — must NOT contain apiToken
2. run it
     docker run  (ghcr.io/dynatrace-oss/dynatrace-managed-mcp:latest)
     docker compose
     kubernetes (Deployment + Service + Ingress)
3. put TLS in front  — required; nginx example
4. smoke-test with curl
5. connect your client  → client guides
limits & tuning
```

Four things the current README never states:

- The environment config **must not contain `apiToken`** in HTTP mode; tokens arrive per request only.
- There is **no startup validation** in HTTP mode — the opposite of local mode. A bad URL surfaces as a per-request `401 Unauthorized: no valid Dynatrace token supplied`, not a startup crash. Token validity is cached for 60 s (`DT_MCP_TOKEN_VALIDATION_TTL_MS`).
- `--host` defaults to `127.0.0.1`, so a container started with default flags is **unreachable**. `--host 0.0.0.0` is required. This gets a callout: it is a guaranteed first-attempt failure.
- `--server` is an undocumented alias for `--http`. `DT_MCP_MAX_BODY_SIZE` (1 MB default, `413` beyond it) is undocumented entirely.

Limits subsection: 16 KB header ≈ 145 environments, `--max-http-header-size`, nginx `large_client_header_buffers`. Rate limiting is noted as **per caller** in HTTP mode (bucketed by the token header), not per server — that changes how `DT_MCP_RATE_LIMIT_MAX_CALLS` should be sized for a shared deployment.

### `docs/clients/*.md`

All five share one skeleton, so they are diffable against each other and a reader switching tools finds the same shape:

```text
1. Prerequisites          (link back to token + config file)
2. Add the server — local (stdio)
3. Add the server — remote (HTTP)      ← the half missing today
4. Verify it connected    (client-specific)
5. Notes & logs           (client-specific quirks)
```

Claude Code, verified against the installed CLI:

```bash
# local
claude mcp add dynatrace-managed -s project \
  -e DT_CONFIG_FILE=~/.dynatrace/managed-mcp.yaml \
  -- npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest

# remote
claude mcp add --transport http dynatrace-managed https://mcp.internal.example.com/ \
  --header "X-Dynatrace-Tokens: prod=dt0c01.YOUR_TOKEN"
```

Copilot CLI's page carries the caveat that `mcp-compat.ts` exists for: its model API rejects `$schema` and `additionalProperties: false`, which is why older server versions failed there with a 400.

### `docs/troubleshooting.md`

Keyed to strings the server actually emits, so a customer can search their error text and land on the fix:

| Symptom                                                   | Cause                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| `EBADENGINE` on install                                   | Node outside `>=26.5.1 <27`                                    |
| exit 1, `No valid environments found, stopping.`          | stdio startup validation failed for every environment          |
| `Failed to get managed environments configurations`       | config file unreadable, or schema invalid                      |
| `401 Unauthorized: no valid Dynatrace token supplied`     | HTTP mode, missing/invalid `X-Dynatrace-Tokens`                |
| `Rate limit exceeded: Maximum N tool calls per M seconds` | `DT_MCP_RATE_LIMIT_*` tuning                                   |
| `413 Request Entity Too Large`                            | `DT_MCP_MAX_BODY_SIZE`                                         |
| `Mcp error: -32002: connection closed`                    | server failed to start; run it standalone                      |
| `Transport closed`                                        | stray stdout on stdio transport                                |
| Remote server unreachable from another host               | `--host` still `127.0.0.1`                                     |
| Requests rejected with many environments                  | header size limit                                              |
| Proxy appears to be ignored                               | proxy must be per-environment config fields, not `HTTPS_PROXY` |

## Migration map

All 778 current lines are accounted for.

| Current lines                         | Destination                                       | Action                                                                                                                        |
| ------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1–34                                  | `README.md`                                       | rewrite tighter                                                                                                               |
| 36–39 Quickstart stub                 | —                                                 | delete; replaced by the real quickstart                                                                                       |
| 41–53, 135–160 methods and priority   | `configuration.md`                                | rewrite; `DT_ENVIRONMENT_CONFIGS` demoted                                                                                     |
| 54–87 config examples                 | `setup-local.md` + `configuration.md`             | split: minimal vs full schema                                                                                                 |
| 89–133 MCP snippets                   | `clients/*.md`                                    | rewrite per client in `DT_CONFIG_FILE` form                                                                                   |
| 162–191 **and** 568–579 field lists   | `configuration.md`                                | merge into one table; keep the `required` markers                                                                             |
| 192–202 Getting Started               | four destinations                                 | restart note → `setup-local.md`; version → README + `api-token.md`; rules → `multi-environment.md`; cost note → `overview.md` |
| 204–212 architecture diagrams         | `overview.md`                                     | move                                                                                                                          |
| 214–258 HTTP auth and limits          | `setup-remote.md`                                 | move (currently under _Architecture_)                                                                                         |
| 260–276 use cases                     | `overview.md`                                     | move                                                                                                                          |
| 277–286 capabilities                  | `README.md` + `overview.md`                       | bullets stay in README, detail moves                                                                                          |
| 287–295 performance                   | `overview.md`                                     | move                                                                                                                          |
| 297–302 Configuration intro           | —                                                 | delete                                                                                                                        |
| 303–333 VS Code                       | `clients/vs-code-copilot.md`                      | rewrite                                                                                                                       |
| 335–349 Claude Desktop                | `clients/claude-desktop.md`                       | rewrite                                                                                                                       |
| 351–369 Kiro                          | `clients/other-clients.md`                        | condense                                                                                                                      |
| 371–404 Gemini CLI                    | `clients/other-clients.md`                        | condense; fix defect 3                                                                                                        |
| 406–444 HTTP Server Mode              | `setup-remote.md`                                 | move; fix defect 1                                                                                                            |
| 446–488 rule file + EasyTrade example | `multi-environment.md`                            | move as-is                                                                                                                    |
| 490–506 configuration variables       | `configuration.md`                                | move                                                                                                                          |
| 508–554 logging variables and matrix  | `configuration.md`                                | move                                                                                                                          |
| 556–566 rate limiting                 | `configuration.md` (+ note in `setup-remote.md`)  | move                                                                                                                          |
| 581–611 proxy                         | `configuration.md`                                | rewrite; fix defect 7                                                                                                         |
| 613–638 authentication and scopes     | `api-token.md`                                    | move → single source                                                                                                          |
| 640–648 SaaS differences              | `overview.md`                                     | move                                                                                                                          |
| 650–663 hybrid setup                  | `hybrid-saas-managed.md`                          | move                                                                                                                          |
| 665–732 rules/steering, 3 templates   | `multi-environment.md` + `hybrid-saas-managed.md` | split by topic                                                                                                                |
| 734–736 example prompts               | `README.md` link                                  | already covered by `examples/`                                                                                                |
| 738–750 troubleshooting               | `troubleshooting.md`                              | expand; fix defect 2                                                                                                          |
| 752–778 telemetry                     | `configuration.md` + 3 lines in README            | move                                                                                                                          |

### Net-new content

- `docs/clients/claude-code.md` and `docs/clients/copilot-cli.md` (entirely new).
- Remote-mode variants on all five client pages.
- GHCR container usage: `docker run`, compose, Kubernetes manifests.
- TLS reverse-proxy example.
- curl smoke test (adapted from `docs/DEVELOPMENT.md`, cross-linked rather than duplicated).
- Node `engines` prerequisite.
- `--server`, `DT_MCP_MAX_BODY_SIZE`, `DT_MCP_TOKEN_VALIDATION_TTL_MS`.
- `docs/README.md` index.
- Explicit verification steps in both mode guides.
- `docs/troubleshooting.md` as a real page.

## Defects to fix

| #   | Location   | Defect                                                                                                                                                                                    | Correction                                                                                                                                                                  |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | L425–427   | Instructs users to run `@dynatrace-oss/dynatrace-mcp-server` — the **SaaS** package                                                                                                       | `@dynatrace-oss/dynatrace-managed-mcp-server`                                                                                                                               |
| 2   | L748       | Code block indented inside a fence; renders broken                                                                                                                                        | Proper fenced block                                                                                                                                                         |
| 3   | L378       | `gemini extensions install <repo>` cannot work — no `gemini-extension.json` in this repo                                                                                                  | Plain `settings.json` snippet                                                                                                                                               |
| 4   | L38        | Advertises Cursor, Windsurf, ChatGPT, Copilot with no instructions                                                                                                                        | The claim is kept and made true: `other-clients.md` covers every client named, and Copilot gets two dedicated pages                                                         |
| 5   | absent     | Node `engines` `>=26.5.1 <27` documented nowhere                                                                                                                                          | Prerequisites section                                                                                                                                                       |
| 6   | absent     | Signed multi-arch image at `ghcr.io/dynatrace-oss/dynatrace-managed-mcp` undocumented                                                                                                     | `setup-remote.md`                                                                                                                                                           |
| 7   | L583       | "honors system proxy settings" is false — `HTTP_PROXY`/`HTTPS_PROXY` are never read from `process.env` by the server; only the per-environment `httpProxyUrl`/`httpsProxyUrl` fields work | State the per-environment fields as the only mechanism, and warn that setting **both** on one environment disables the proxy entirely (`setAxiosProxy` returns `undefined`) |
| 8   | L185, L573 | `DT_API_ENDPOINT_URL` does not exist                                                                                                                                                      | `dynatraceUrl` falls back to the `apiEndpointUrl` **field** of the same entry (`src/utils/environment.ts:29`)                                                               |

Defect 7 is the most damaging: a customer behind a corporate proxy who exports `HTTPS_PROXY` as documented gets silent connection failures.

### Code observations for separate follow-up (out of scope here)

- The server does not honour `HTTP_PROXY`/`HTTPS_PROXY`, which most tooling treats as standard. Supporting them as a fallback would be a code change, not a documentation change.
- Setting both proxy fields on one environment silently disables the proxy rather than failing fast.
- `server.json` marks `DT_ENVIRONMENT_CONFIGS` as `isRequired: true` and does not list `DT_CONFIG_FILE`. Once the config file is the recommended method, this misrepresents the server to the MCP registry.

## Verification

Structural and local checks only; no live cluster, and the local `.env` / `dt-config.yaml` credential files are not read.

1. `npm run prettier` passes (already gated by husky).
2. markdownlint passes under the repo's `.markdownlint.yml`.
3. Every relative link and heading anchor across README and `docs/` resolves. No link points at a removed README anchor.
4. Every env var documented in `docs/configuration.md` matches `grep -rho 'process\.env\.[A-Z_0-9]*' src/`, in both directions: nothing documented that does not exist, nothing implemented that is undocumented.
5. Every CLI flag matches `node ./dist/index.js --help`.
6. Container path: `docker build` succeeds; the container starts; `--host 0.0.0.0` is reachable and default `127.0.0.1` is not.
7. HTTP mode: a request without `X-Dynatrace-Tokens` returns `401` with the documented message, and a malformed body returns the documented JSON-RPC error. This exercises the auth path without a valid token.
8. The Managed minimum version in the docs matches `MINIMUM_VERSION` in `src/authentication/managed-auth-client.ts` (currently `1.328.0`).
9. `docs/DEVELOPMENT.md` cross-links still resolve after the move.

### Known-unverifiable content

- **Copilot CLI and ChatGPT registration syntax.** No Copilot CLI is installed in this environment and both tools change quickly. These must be checked against current upstream documentation at implementation time, not written from memory.
- **Kubernetes and nginx manifests.** No cluster is available. They ship labelled as illustrative starting points to adapt, not verified configurations.

## Success criteria

- README is roughly 170 lines and contains an actionable quickstart.
- A reader can get from README to a working setup for any of the four first-class clients by following one page plus the token page.
- Local and remote mode each have exactly one hub page covering the full path, including how to verify it worked.
- No fact appears in two files. In particular there is one scopes list, one env-var table, one config-field table.
- All eight defects are corrected.
- Verification steps 1–9 pass.
