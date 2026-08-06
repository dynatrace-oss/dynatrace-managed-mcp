# Documentation Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unusable 778-line README with a ~170-line landing page plus 15 task-oriented guides under `docs/`, so a customer can set up local or remote mode for their AI client in about five minutes.

**Architecture:** Documentation-only change. Every fact gets exactly one owner file (see the ownership table in the spec) so the duplication that caused this cannot re-form. A committed Node verification script replaces manual checking: it resolves every relative link and heading anchor, cross-checks documented environment variables against `process.env` reads in `src/`, and guards the eight corrected defects against regression. Content is migrated from the old README, which remains available on the base branch.

**Tech Stack:** Markdown, Prettier 3.7 (`npm run prettier`), markdownlint-cli2 (config `.markdownlint.yml`, `MD013` and `MD026` disabled), Node ESM script (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-08-06-readme-restructure-design.md`

**Branch:** `docs/restructure-documentation` (already created; the spec is committed on it)

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the spec and from the source of truth named in brackets.

- **Node constraint:** `>=26.5.1 <27` — this exact string must appear in `README.md` prerequisites [`package.json` `engines.node`].
- **Minimum cluster version:** `1.328.0` [`src/authentication/managed-auth-client.ts:5`, `MINIMUM_VERSION`].
- **npm package name:** `@dynatrace-oss/dynatrace-managed-mcp-server`. The string `@dynatrace-oss/dynatrace-mcp-server` (the SaaS package) must never appear in any documentation file. The SaaS _repository_ link `https://github.com/dynatrace-oss/dynatrace-mcp` is legitimate and expected.
- **Container image:** `ghcr.io/dynatrace-oss/dynatrace-managed-mcp:latest` — multi-arch (`linux/amd64`, `linux/arm64`), cosign-signed [`.github/workflows/release.yml`].
- **Taught config method:** a YAML file referenced by `DT_CONFIG_FILE`, in **every** setup snippet. `DT_ENVIRONMENT_CONFIGS` appears only in `docs/configuration.md` and the Docker/Kubernetes parts of `docs/setup-remote.md`.
- **Config path convention:** `~/.dynatrace/managed-mcp.yaml`, written identically on every page. The server expands `~` itself [`src/utils/config-loader.ts:124`], so this is safe in every client.
- **The 13 documentable environment variables** [`grep process.env src/ --include=*.ts`, excluding `__tests__`]: `DT_CONFIG_FILE`, `DT_ENVIRONMENT_CONFIGS`, `LOG_LEVEL`, `LOG_OUTPUT`, `LOG_FILE`, `DT_MCP_RATE_LIMIT_MAX_CALLS`, `DT_MCP_RATE_LIMIT_WINDOW_MS`, `DT_MCP_MAX_BODY_SIZE`, `DT_MCP_TOKEN_VALIDATION_TTL_MS`, `DT_MCP_DISABLE_TELEMETRY`, `DT_MCP_TELEMETRY_APPLICATION_ID`, `DT_MCP_TELEMETRY_ENDPOINT_URL`, `DT_MCP_TELEMETRY_DEVICE_ID`. `HOME` and `USERPROFILE` are internal and are not documented as configuration.
- **`DT_API_ENDPOINT_URL` does not exist.** It must never appear in documentation.
- **No changes to `src/`.** Where docs and code disagree, the docs are corrected.
- **Every task ends green:** `npm run prettier` and `npx markdownlint-cli2 <changed files>` pass, and `node scripts/check-docs.mjs` reports no hard errors — **except** where a task's own steps name the exact errors it is permitted to leave open (Task 1, which must fail by design, and Task 2, which may leave exactly the two named environment-variable errors for Task 4 to close). No task may leave an error its own steps do not name. Pending links are expected until Task 13.
- **Migration source:** the old 778-line README is on the base branch. Retrieve any range with `git show main:README.md | sed -n 'A,Bp'`.

---

## File Structure

| Path                              | Status  | Responsibility                                                                         |
| --------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| `scripts/check-docs.mjs`          | Create  | Link/anchor resolution, env-var cross-check, defect regression guards                  |
| `README.md`                       | Rewrite | Landing page: pitch, SaaS callout, capabilities, prerequisites, quickstart, link table |
| `docs/README.md`                  | Create  | Index table of all guides                                                              |
| `docs/api-token.md`               | Create  | The only list of required scopes; token creation; minimum version                      |
| `docs/configuration.md`           | Create  | The only env-var table and config-file schema                                          |
| `docs/setup-local.md`             | Create  | stdio hub                                                                              |
| `docs/setup-remote.md`            | Create  | HTTP hub incl. container/Kubernetes/TLS                                                |
| `docs/clients/claude-code.md`     | Create  | Claude Code (establishes the shared page skeleton)                                     |
| `docs/clients/vs-code-copilot.md` | Create  | VS Code + Copilot agent mode                                                           |
| `docs/clients/copilot-cli.md`     | Create  | Copilot CLI                                                                            |
| `docs/clients/claude-desktop.md`  | Create  | Claude Desktop                                                                         |
| `docs/clients/other-clients.md`   | Create  | Cursor, Windsurf, Kiro, Gemini CLI, ChatGPT                                            |
| `docs/multi-environment.md`       | Create  | Aliases, rule/steering templates, per-env proxy usage                                  |
| `docs/hybrid-saas-managed.md`     | Create  | Running alongside the SaaS MCP                                                         |
| `docs/troubleshooting.md`         | Create  | Symptom → cause → fix                                                                  |
| `docs/overview.md`                | Create  | Use cases, architecture diagrams, SaaS differences, performance                        |
| `docs/DEVELOPMENT.md`             | Modify  | Fix cross-links into the new files                                                     |
| `examples/README.md`              | Modify  | Add a link back to the docs index only                                                 |

`docs/superpowers/**` is excluded from all checks — it holds this plan and the spec, which quote the forbidden strings deliberately.

---

### Task 1: Verification harness

The checker is written first because it is the test cycle for all twelve remaining tasks. Its first run must **fail against the current documentation**, reporting the real defects — that is the failing test that proves the defects exist.

It separates two error classes:

- **Hard errors** — forbidden strings, missing Node constraint, env-var mismatches, wrong minimum version, anchors missing from files that exist. Always fail the run.
- **Pending links** — relative link targets that do not exist yet. Reported and counted, but only fail under `--strict`. This lets Tasks 2–12 stay green while the link targets are still being created; Task 13 enforces zero.

> **Note for the reviewer:** `scripts/check-docs.mjs` is an addition beyond the spec's file list. It exists because spec verification steps 3, 4 and 8 are otherwise manual across 17 heavily cross-linked files. Rejecting this task alone is viable — the remaining tasks would then verify by hand.

**Files:**

- Create: `scripts/check-docs.mjs`
- Modify: `package.json` (add one script entry)

**Interfaces:**

- Consumes: nothing.
- Produces: the command `node scripts/check-docs.mjs` (exit 0 = no hard errors) and `node scripts/check-docs.mjs --strict` (exit 0 = no hard errors **and** no pending links). Also `npm run check:docs`. Every later task uses these.

- [ ] **Step 1: Write the checker**

Create `scripts/check-docs.mjs`:

```js
#!/usr/bin/env node
// Verifies the documentation set: relative links and anchors resolve, documented
// environment variables match what src/ actually reads, and previously-fixed
// documentation defects do not regress.
//
//   node scripts/check-docs.mjs            hard errors fail; pending links reported
//   node scripts/check-docs.mjs --strict   pending links also fail
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const STRICT = process.argv.includes('--strict');

const hardErrors = [];
const pendingLinks = [];

/** Recursively collect files with the given extension, skipping excluded dirs. */
function walk(dir, ext, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // superpowers/ holds the spec and plan, which quote forbidden strings on purpose.
      if (['node_modules', '.git', 'superpowers', '__tests__'].includes(entry)) continue;
      walk(full, ext, acc);
    } else if (entry.endsWith(ext)) {
      acc.push(full);
    }
  }
  return acc;
}

const DOC_FILES = [
  join(ROOT, 'README.md'),
  ...walk(join(ROOT, 'docs'), '.md'),
  join(ROOT, 'examples/README.md'),
].filter(existsSync);

const read = (f) => readFileSync(f, 'utf8');
const rel = (f) => relative(ROOT, f);

// ---------- 1. relative links and heading anchors ----------

/** Approximates GitHub's heading-to-anchor slug. */
const slugify = (heading) =>
  heading
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

const anchorCache = new Map();
function anchorsOf(file) {
  if (!anchorCache.has(file)) {
    const set = new Set();
    for (const line of read(file).split('\n')) {
      const m = /^#{1,6}\s+(.*)$/.exec(line);
      if (m) set.add(slugify(m[1]));
    }
    anchorCache.set(file, set);
  }
  return anchorCache.get(file);
}

for (const file of DOC_FILES) {
  const text = read(file);
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) {
      // Same-file anchor: verify against this file's own headings.
      if (target.startsWith('#') && !anchorsOf(file).has(target.slice(1))) {
        hardErrors.push(`${rel(file)}: missing same-file anchor -> ${target}`);
      }
      continue;
    }
    const [path, anchor] = target.split('#');
    const resolved = resolve(dirname(file), path);
    if (!existsSync(resolved)) {
      pendingLinks.push(`${rel(file)}: link target does not exist -> ${target}`);
      continue;
    }
    if (anchor && resolved.endsWith('.md') && !anchorsOf(resolved).has(anchor)) {
      hardErrors.push(`${rel(file)}: missing anchor -> ${target}`);
    }
  }
}

// ---------- 2. environment variables: docs vs src/ ----------

// Read by the process but not user-facing configuration.
const INTERNAL = new Set(['HOME', 'USERPROFILE']);

// Illustrative names used in ${VAR} interpolation examples; chosen by the user,
// never read by the server. Documented on purpose.
const DOC_ONLY = new Set(['DT_PROD_TOKEN', 'DT_STAGING_TOKEN']);

const srcVars = new Set();
for (const file of walk(join(ROOT, 'src'), '.ts')) {
  for (const m of read(file).matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
    if (!INTERNAL.has(m[1])) srcVars.add(m[1]);
  }
}

const docText = DOC_FILES.map(read).join('\n');
const docVars = new Set([...docText.matchAll(/`(DT_[A-Z0-9_]+|LOG_[A-Z0-9_]+)`/g)].map((m) => m[1]));

for (const v of srcVars) {
  if (!docVars.has(v)) hardErrors.push(`env var read by src/ but not documented: ${v}`);
}
for (const v of docVars) {
  if (!srcVars.has(v) && !DOC_ONLY.has(v)) {
    hardErrors.push(`env var documented but never read by src/: ${v}`);
  }
}

// ---------- 3. defect 7 guard ----------
// The docs state that the standard proxy variables are ignored. If src/ starts
// reading them, the docs are now wrong and must be updated.
for (const v of ['HTTP_PROXY', 'HTTPS_PROXY']) {
  if (srcVars.has(v)) {
    hardErrors.push(`src/ now reads ${v}, but docs/configuration.md states it is ignored — update the docs`);
  }
}

// ---------- 4. regression guards for corrected defects ----------
const FORBIDDEN = [
  ['@dynatrace-oss/dynatrace-mcp-server', 'that is the SaaS package; use @dynatrace-oss/dynatrace-managed-mcp-server'],
  ['DT_API_ENDPOINT_URL', 'no such variable; dynatraceUrl falls back to the apiEndpointUrl field'],
  ['gemini extensions install', 'this repo ships no gemini-extension.json'],
];
for (const file of DOC_FILES) {
  const text = read(file);
  for (const [needle, why] of FORBIDDEN) {
    if (text.includes(needle)) {
      hardErrors.push(`${rel(file)}: forbidden string "${needle}" — ${why}`);
    }
  }
}

// ---------- 5. minimum cluster version matches src/ ----------
const authSrc = read(join(ROOT, 'src/authentication/managed-auth-client.ts'));
const minVersion = /export const MINIMUM_VERSION = '([^']+)'/.exec(authSrc)?.[1];
if (!minVersion) {
  hardErrors.push('could not read MINIMUM_VERSION from src/authentication/managed-auth-client.ts');
} else if (!docText.includes(minVersion)) {
  hardErrors.push(`MINIMUM_VERSION ${minVersion} from src/ is not stated anywhere in the docs`);
}

// ---------- 6. Node engines constraint is stated in the README ----------
const enginesNode = JSON.parse(read(join(ROOT, 'package.json'))).engines.node;
if (!read(join(ROOT, 'README.md')).includes(enginesNode)) {
  hardErrors.push(`package.json engines.node "${enginesNode}" is not stated in README.md`);
}

// ---------- report ----------
if (pendingLinks.length) {
  const label = STRICT ? 'ERROR' : 'pending';
  console.error(`\n${pendingLinks.length} link target(s) not yet created (${label}):\n`);
  for (const e of pendingLinks) console.error(`  - ${e}`);
}
if (hardErrors.length) {
  console.error(`\n${hardErrors.length} documentation error(s):\n`);
  for (const e of hardErrors) console.error(`  x ${e}`);
}
if (hardErrors.length || (STRICT && pendingLinks.length)) {
  process.exit(1);
}
console.log(`Documentation checks passed (${DOC_FILES.length} files checked).`);
```

- [ ] **Step 2: Run it against the current docs and confirm it fails with the real defects**

Run: `node scripts/check-docs.mjs`

Expected: exit 1. The output must include all of these — they are the defects this project exists to fix:

- `forbidden string "@dynatrace-oss/dynatrace-mcp-server"` (defect 1, README L425–427)
- `forbidden string "DT_API_ENDPOINT_URL"` (defect 8, README L185/L573)
- `forbidden string "gemini extensions install"` (defect 3, README L378)
- `env var read by src/ but not documented: DT_MCP_MAX_BODY_SIZE`
- `env var read by src/ but not documented: DT_MCP_TOKEN_VALIDATION_TTL_MS`
- `package.json engines.node ">=26.5.1 <27" is not stated in README.md` (defect 5)

If any of those six are missing from the output, the checker is broken — fix the checker, not the docs.

- [ ] **Step 3: Add the npm script**

In `package.json`, inside `"scripts"`, after the `"prettier:fix"` entry:

```json
    "check:docs": "node scripts/check-docs.mjs"
```

- [ ] **Step 4: Verify the npm script runs the checker**

Run: `npm run check:docs`
Expected: same failure output as Step 2, exit 1.

- [ ] **Step 5: Format and lint**

Run: `npx prettier --write scripts/check-docs.mjs package.json && npx prettier --check .`
Expected: "All matched files use Prettier code style!"

- [ ] **Step 6: Commit**

```bash
git add scripts/check-docs.mjs package.json
git commit -m "NOISSUE(docs): add documentation verification script

Checks relative links and heading anchors, cross-checks documented
environment variables against process.env reads in src/, and guards the
documentation defects corrected in this branch against regression.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: README landing page

Rewritten early: it defines the link contract every later page must satisfy. Its links to not-yet-created pages surface as _pending_ and shrink task by task.

**Files:**

- Modify: `README.md` (full rewrite, 778 → ~170 lines)

**Interfaces:**

- Consumes: `node scripts/check-docs.mjs` from Task 1.
- Produces: the canonical link targets every later task must create at exactly these paths — `docs/README.md`, `docs/api-token.md`, `docs/configuration.md`, `docs/setup-local.md`, `docs/setup-remote.md`, `docs/clients/claude-code.md`, `docs/clients/vs-code-copilot.md`, `docs/clients/copilot-cli.md`, `docs/clients/claude-desktop.md`, `docs/clients/other-clients.md`, `docs/multi-environment.md`, `docs/hybrid-saas-managed.md`, `docs/troubleshooting.md`, `docs/overview.md`. Also produces the quickstart YAML shape reused verbatim by Tasks 5 and 7–9.

- [ ] **Step 1: Capture the migration source**

Run: `git show main:README.md > /tmp/claude-502/-workspace-dynatrace-managed-mcp/8022d2e4-944d-4153-9145-906affb0f1c5/scratchpad/legacy-readme.md && wc -l /tmp/claude-502/-workspace-dynatrace-managed-mcp/8022d2e4-944d-4153-9145-906affb0f1c5/scratchpad/legacy-readme.md`
Expected: `778`

Keep this file for Tasks 3–12. It is the source for every "migrate lines A–B" instruction.

- [ ] **Step 2: Rewrite `README.md`**

Preserve verbatim from the legacy README: the badge block (L3–19) and the two callouts (L28–34). Everything else is new or condensed as follows.

Structure, in order:

1. `# Dynatrace Managed MCP Server` + badge block (legacy L3–19, unchanged).
2. One-paragraph pitch, condensed from legacy L21–26. State that it supports two modes and name them: local (stdio) and remote (HTTP).
3. The two callouts from legacy L28–34, unchanged: the SaaS `[!TIP]` pointing at `https://github.com/dynatrace-oss/dynatrace-mcp`, and the community-support `[!NOTE]`.
4. `## Capabilities` — the seven bullets from legacy L279–285, unchanged, followed by one line: `For use cases and architecture, see [Overview](docs/overview.md).`
5. `## Prerequisites` — a new section. Three bullets:
   - Node.js `>=26.5.1 <27` — write this exact string, and add: "`npm` refuses to install with `EBADENGINE` outside this range."
   - Dynatrace Managed `1.328.0` or later.
   - Network access from where the server runs to your cluster API endpoint (often port `9999`).
6. `## Quickstart` — four numbered steps:
   - Step 1: "Create a Dynatrace API token with the required scopes — see [Create an API token](docs/api-token.md)." No scope list here.
   - Step 2: "Create `~/.dynatrace/managed-mcp.yaml`:" followed by this exact block, then "Restrict its permissions — `chmod 600 ~/.dynatrace/managed-mcp.yaml` on macOS and Linux." and "Multiple environments, proxies and every other field: [Configuration reference](docs/configuration.md)."

     ````markdown
     ```yaml
     - alias: production
       apiEndpointUrl: https://abc123.dynatrace-managed.com:9999
       environmentId: 01234567-89ab-cdef-abcd-ef0123456789
       apiToken: dt0c01.ABC123...
     ```
     ````

   - Step 3: "Add the server to your AI client:" followed by this table:

     ```markdown
     | Client             | Guide                                                   |
     | ------------------ | ------------------------------------------------------- |
     | Claude Code        | [Set up Claude Code](docs/clients/claude-code.md)       |
     | VS Code + Copilot  | [Set up VS Code](docs/clients/vs-code-copilot.md)       |
     | GitHub Copilot CLI | [Set up Copilot CLI](docs/clients/copilot-cli.md)       |
     | Claude Desktop     | [Set up Claude Desktop](docs/clients/claude-desktop.md) |
     ```

     Then: "Cursor, Windsurf, Kiro, Gemini CLI and ChatGPT: [other clients](docs/clients/other-clients.md)."

   - Step 4: "Ask your assistant: `Ask Dynatrace to list problems`." Add what success looks like — the assistant calls a Dynatrace tool and returns problems from the environment aliased `production`. Then: "Nothing happening? [Troubleshooting](docs/troubleshooting.md)."

7. `## Documentation` — a table linking every page: `docs/README.md`, `docs/api-token.md`, `docs/setup-local.md`, `docs/setup-remote.md`, the five client pages, `docs/configuration.md`, `docs/multi-environment.md`, `docs/hybrid-saas-managed.md`, `docs/troubleshooting.md`, `docs/overview.md`, `examples/README.md`, `docs/DEVELOPMENT.md`. One-line description each.
8. `## Telemetry` — three lines condensed from legacy L752–765: enabled by default, anonymous usage and error data only, disable with `DT_MCP_DISABLE_TELEMETRY=true`. Link to `docs/configuration.md` for the full option list. Write `DT_MCP_DISABLE_TELEMETRY` in backticks so the checker counts it as documented.
9. `## Contributing`, `## Support`, `## License` — short sections linking `CONTRIBUTING.md`, the issues URL, and `LICENSE`.

Do **not** include in the README: any client JSON snippet beyond the table, any environment-variable reference table, the architecture images, use cases, the hybrid section, rule-file templates, or `DT_ENVIRONMENT_CONFIGS`.

- [ ] **Step 3: Verify hard errors are gone**

Run: `node scripts/check-docs.mjs`

Expected: exit 0 for hard errors. Specifically, these must no longer appear:

- the three forbidden strings (they left with the old README body)
- `engines.node ">=26.5.1 <27" is not stated in README.md`
- `MINIMUM_VERSION 1.328.0 ... not stated`

`DT_MCP_MAX_BODY_SIZE` and `DT_MCP_TOKEN_VALIDATION_TTL_MS` are still reported as undocumented — Task 4 fixes those. Until then this task's gate is: **no hard errors other than those two**, plus a list of pending links for the fourteen pages not yet created.

If the two env-var errors block exit 0, add `DT_MCP_MAX_BODY_SIZE` and `DT_MCP_TOKEN_VALIDATION_TTL_MS` to nothing — do not paper over it in the README. Instead accept exit 1 for this task with **only** those two errors present, and record that in the commit message. Task 4 closes them.

- [ ] **Step 4: Confirm the README length target**

Run: `wc -l README.md`
Expected: between 140 and 200 lines. If over 200, content belongs in `docs/` — move it.

- [ ] **Step 5: Format and lint**

Run: `npx prettier --write README.md && npx markdownlint-cli2 README.md`
Expected: `Summary: 0 issues`

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "NOISSUE(docs): rewrite README as a landing page

Replaces 778 lines with a pitch, capabilities, prerequisites, a
four-step quickstart and a documentation link table. Adds the missing
Node engines constraint. Deep content moves to docs/ in follow-up commits.

Two environment variables (DT_MCP_MAX_BODY_SIZE,
DT_MCP_TOKEN_VALIDATION_TTL_MS) remain undocumented until the
configuration reference lands.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: API token guide

**Files:**

- Create: `docs/api-token.md`

**Interfaces:**

- Consumes: the README link `docs/api-token.md` from Task 2.
- Produces: the anchor `#required-scopes`, linked by Tasks 4, 5, 6 and 12. Also the only scope list in the documentation — no other page may restate it.

- [ ] **Step 1: Confirm the link is pending**

Run: `node scripts/check-docs.mjs 2>&1 | grep api-token`
Expected: `README.md: link target does not exist -> docs/api-token.md`

- [ ] **Step 2: Write `docs/api-token.md`**

Migration source: `sed -n '613,638p' legacy-readme.md`.

Structure:

1. `# Create an API token` — one sentence: Dynatrace Managed uses API token authentication.
2. `## Create the token` — steps to create a token in the Managed cluster UI, linking `https://docs.dynatrace.com/managed/discover-dynatrace/references/dynatrace-api/basics/dynatrace-api-authentication` (from legacy L619).
3. `## Required scopes` — the ten scopes from legacy L627–636, verbatim, each as `display name (technical-name)`:
   `DataExport`, `auditLogs.read`, `entities.read`, `events.read`, `logs.read`, `metrics.read`, `networkZones.read`, `problems.read`, `securityProblems.read`, `slo.read`. Keep the note from legacy L638 that Managed scopes differ from SaaS Platform tokens.
4. `## Where the token goes` — two short subsections, no snippets:
   - Local (stdio): the token lives in your config file server-side → link `setup-local.md`.
   - Remote (HTTP): the server holds no tokens; each user sends their own in the `X-Dynatrace-Tokens` header → link `setup-remote.md`.
     Note that the scopes above apply identically in both modes (legacy L617).
5. `## Minimum cluster version` — Dynatrace Managed `1.328.0` or later. Add that on older clusters the server logs a warning naming the environment and continues, and that if the token lacks permission for `/api/v1/config/clusterversion` the server assumes the minimum version [`src/authentication/managed-auth-client.ts:134`].
6. `## Token problems` — one line linking `troubleshooting.md`.

- [ ] **Step 3: Verify**

Run: `node scripts/check-docs.mjs 2>&1 | grep -c api-token`
Expected: `0`

- [ ] **Step 4: Confirm the scope list is single-sourced**

Run: `grep -rln "securityProblems.read" README.md docs/ --include="*.md" | grep -v superpowers`
Expected: exactly one line — `docs/api-token.md`

- [ ] **Step 5: Format and lint**

Run: `npx prettier --write docs/api-token.md && npx markdownlint-cli2 docs/api-token.md`
Expected: `Summary: 0 issues`

- [ ] **Step 6: Commit**

```bash
git add docs/api-token.md
git commit -m "NOISSUE(docs): add API token guide as the single source for scopes

Moves token creation and the ten required scopes out of the README, where
they sat ~600 lines below the first snippet that needed them.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Configuration reference

Carries defects 7 and 8, merges the two duplicated field tables, and documents the two previously-undocumented variables. This is the task that turns the checker fully green.

**Files:**

- Create: `docs/configuration.md`

**Interfaces:**

- Consumes: the README link from Task 2; `docs/api-token.md#required-scopes` from Task 3.
- Produces: anchors `#configuration-file`, `#environment-variables`, `#logging`, `#proxy`, `#rate-limiting`, `#telemetry`, linked by Tasks 5, 6, 7–9, 11 and 12, and by `docs/DEVELOPMENT.md` in Task 13. This is the only file that may contain an environment-variable table or a config-field table.

- [ ] **Step 1: Confirm the two env-var errors are still open**

Run: `node scripts/check-docs.mjs 2>&1 | grep "not documented"`
Expected: two lines naming `DT_MCP_MAX_BODY_SIZE` and `DT_MCP_TOKEN_VALIDATION_TTL_MS`

- [ ] **Step 2: Write `docs/configuration.md`**

Migration sources: legacy L41–53 (methods), L154–160 (priority), L162–191 **and** L568–579 (the two field lists — merge), L490–566 (env vars, logging, rate limits), L581–611 (proxy), L752–778 (telemetry).

Structure:

1. `# Configuration reference` — one sentence, plus: "For step-by-step setup see [local mode](setup-local.md) or [remote mode](setup-remote.md)."
2. `## Configuration file` — the recommended method.
   - The `DT_CONFIG_FILE` path rules from legacy L494–499: relative (resolved against the **client's** working directory, which is why an absolute or `~` path is recommended), absolute, `~` expansion, and `${VAR_NAME}` interpolation inside the file. State that the server performs `~` expansion itself via `HOME` then `USERPROFILE` [`src/utils/config-loader.ts:124`].
   - A full YAML example — start from legacy L56–72, and **change `apiToken: ${DT_PROD_TOKEN}` to a plain token value in the primary example**, with the interpolation form shown immediately after as the commit-safe variant. This inverts the legacy emphasis to match the taught method.
   - The JSON equivalent, condensed from legacy L76–87.
   - Link `../examples/dt-config.yaml`, `../examples/dt-config.json`, `../examples/dt-config-http.yaml`.
3. `## Configuration fields` — **one** table replacing both legacy lists. Columns: Field, Required, Description. Rows, with the `required` markers taken from the more accurate legacy L572–579:

   | Field            | Required                                            | Notes                                                                                                                                  |
   | ---------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
   | `apiEndpointUrl` | yes                                                 | Base URL for the Managed API; the environment ID is appended. Example `https://abc123.dynatrace-managed.com:9999`                      |
   | `environmentId`  | yes                                                 | e.g. `01234567-89ab-cdef-abcd-ef0123456789`                                                                                            |
   | `apiToken`       | yes in local mode, **must be omitted in HTTP mode** | See [required scopes](api-token.md#required-scopes)                                                                                    |
   | `alias`          | yes                                                 | Human-readable name; how you refer to the environment when talking to the assistant                                                    |
   | `dynatraceUrl`   | no                                                  | Base URL for the dashboard. **If omitted, falls back to the `apiEndpointUrl` field of the same entry** [`src/utils/environment.ts:29`] |
   | `httpProxyUrl`   | no                                                  | Per-environment HTTP proxy                                                                                                             |
   | `httpsProxyUrl`  | no                                                  | Per-environment HTTPS proxy                                                                                                            |

   The `dynatraceUrl` row is **defect 8**: legacy L184–185 and L573 claimed the fallback was an environment variable named `DT_API_ENDPOINT_URL`, which does not exist. Do not write that string.

4. `## Environment variables` — one table covering all thirteen from Global Constraints, each name in backticks, grouped: configuration (2), logging (3), rate limiting (2), HTTP transport (2), telemetry (4). The two previously-undocumented ones:
   - `DT_MCP_MAX_BODY_SIZE` — maximum accepted POST body in bytes, HTTP mode. Default `1048576` (1 MB). Larger requests get `413 Request Entity Too Large` [`src/index.ts:339`].
   - `DT_MCP_TOKEN_VALIDATION_TTL_MS` — how long a validated token is cached, HTTP mode. Default `60000` (60 s). `0` disables caching [`src/index.ts:44`].
5. `## Configuration precedence` — from legacy L154–160: `DT_CONFIG_FILE` wins; then `DT_ENVIRONMENT_CONFIGS`; if neither is set the server exits with an error. Add that setting both logs a warning and uses `DT_CONFIG_FILE` [`src/utils/environment.ts:48`].
6. `## DT_ENVIRONMENT_CONFIGS` — the demoted method. Keep legacy L137–148 (a JSON array as a single string, suited to Kubernetes ConfigMaps, Docker and CI) and state plainly that quote escaping makes it awkward for local use and the config file is preferred. One `.env` sentence from legacy L150–152: multiline values are unreliable there.
7. `## Logging` — the `LOG_LEVEL`/`LOG_OUTPUT`/`LOG_FILE` documentation and the full transport matrix from legacy L508–554, unchanged in substance. Keep the `[!IMPORTANT]` callout: on stdio, stdout is the MCP protocol channel, so `stderr-all` or `file` are the usable options, and the server prints a warning if `LOG_OUTPUT` is set to a stdout variant [`src/index.ts:436`].
8. `## Rate limiting` — `DT_MCP_RATE_LIMIT_MAX_CALLS` (default `20`) and `DT_MCP_RATE_LIMIT_WINDOW_MS` (default `20000`) from legacy L556–566. Add the fact the legacy README omitted: the limiter buckets **per caller**, keyed by the supplied token header in HTTP mode and a single key in stdio mode [`src/index.ts:40`, `src/index.ts:181`]. Note the limit is therefore per user, not per server, when sizing it for a shared deployment.
9. `## Proxy` — **defect 7.** Write:
   - Proxies are configured **per environment** with the `httpProxyUrl` / `httpsProxyUrl` config fields. This is the only mechanism.
   - A `[!WARNING]` callout: the standard `HTTP_PROXY` and `HTTPS_PROXY` environment variables are **not** read by this server. Setting them has no effect. (Legacy L583 claimed otherwise.)
   - A second `[!WARNING]`: setting **both** `httpProxyUrl` and `httpsProxyUrl` on the same environment logs an error and disables the proxy for that environment entirely — use exactly one [`src/authentication/managed-auth-client.ts:333`].
   - A YAML example with a proxy on one environment and not the other, adapted from legacy L591–611 into config-file form.
10. `## Telemetry` — the four options from legacy L767–778 and the privacy notes from L760–765.

- [ ] **Step 3: Verify the checker is fully green**

Run: `node scripts/check-docs.mjs`
Expected: **zero hard errors.** Only pending links for pages not yet created remain.

- [ ] **Step 4: Verify defect 7 is stated, not repeated**

Run: `grep -n "HTTPS_PROXY" docs/configuration.md`
Expected: at least one hit, in the warning that it is ignored.

Run: `grep -rn "honors system proxy" README.md docs/ | grep -v superpowers`
Expected: no output — the false claim is gone.

- [ ] **Step 5: Verify the field table is single-sourced**

Run: `grep -rln "httpsProxyUrl" README.md docs/ --include="*.md" | grep -v superpowers`
Expected: `docs/configuration.md` only.

- [ ] **Step 6: Format and lint**

Run: `npx prettier --write docs/configuration.md && npx markdownlint-cli2 docs/configuration.md`
Expected: `Summary: 0 issues`

- [ ] **Step 7: Commit**

```bash
git add docs/configuration.md
git commit -m "NOISSUE(docs): add configuration reference, correct two false claims

Merges the two duplicated field tables into one and documents
DT_MCP_MAX_BODY_SIZE and DT_MCP_TOKEN_VALIDATION_TTL_MS for the first time.

Corrects two claims that never matched the code:
- HTTP_PROXY/HTTPS_PROXY are not read by the server; only the
  per-environment httpProxyUrl/httpsProxyUrl fields work. Setting both on
  one environment silently disables the proxy.
- DT_API_ENDPOINT_URL does not exist; dynatraceUrl falls back to the
  apiEndpointUrl field of the same entry.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Local (stdio) setup hub

**Files:**

- Create: `docs/setup-local.md`

**Interfaces:**

- Consumes: `docs/api-token.md`, `docs/configuration.md`, the client pages (links created here, satisfied by Tasks 7–9).
- Produces: anchor `#verify-the-server-starts`, linked by Task 12 (troubleshooting) and the client pages.

- [ ] **Step 1: Confirm the link is pending**

Run: `node scripts/check-docs.mjs 2>&1 | grep setup-local`
Expected: `README.md: link target does not exist -> docs/setup-local.md`

- [ ] **Step 2: Write `docs/setup-local.md`**

Migration sources: legacy L54–87 (minimal config), L91–133 (run variants), L196 (restart), L523–531 (stdio logging).

Structure:

1. `# Local setup (stdio)` — when to use it: one user, on one machine, tokens stored locally.
2. `## How it works` — the behaviour that explains most local-mode support tickets: the client launches the server as a child process and talks to it over stdio; at startup the server validates **every** configured environment against the live cluster and **exits with code 1** if none are valid [`src/index.ts:124`, `validateManagedClients`]. So local misconfiguration fails immediately and visibly at launch. Contrast in one line with remote mode, where there is no startup validation, and link `setup-remote.md`.
3. `## 1. Create an API token` — link `api-token.md`, no scope list.
4. `## 2. Create the configuration file` — the same YAML block as the README quickstart, verbatim. Then a multi-environment example with two entries and distinct aliases, and: full field reference → `configuration.md#configuration-fields`; multiple environments in practice → `multi-environment.md`.
5. `## 3. Choose how to run the server` — four subsections, each with its command:
   - `npx` latest (recommended): `npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest`
   - Pinned version, for reproducibility: `npx -y @dynatrace-oss/dynatrace-managed-mcp-server@1.0.1` — note that pinning avoids a surprise change mid-sprint.
   - Global install: `npm install -g @dynatrace-oss/dynatrace-managed-mcp-server` then `mcp-server-dynatrace` [the `bin` name in `package.json`].
   - From a clone, for contributors: `npm install && npm run build`, then `node ./dist/index.js`. Link `DEVELOPMENT.md`.
6. `## 4. Verify the server starts` — the standalone check, before involving any client:

   ````markdown
   ```bash
   DT_CONFIG_FILE=~/.dynatrace/managed-mcp.yaml \
     npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest
   ```
   ````

   Expected on success: `Dynatrace Managed MCP Server running on stdio`, **on stderr**. The process then waits for MCP protocol traffic on stdin — that is correct behaviour, not a hang. Press `Ctrl+C`. On failure it prints the configuration errors and exits `1`. Add: this is the fastest way to separate "the server is broken" from "my client config is wrong", and link `troubleshooting.md`.

7. `## 5. Add it to your client` — the same four-row client table as the README, plus the other-clients link.
8. `## Logs` — on stdio, prefer `LOG_OUTPUT=stderr-all` (surfaces in the client's output panel) or the default `file` (`dynatrace-managed-mcp.log` in the working directory, read with `tail -f`). Never a stdout variant: stdout carries the MCP protocol. Full matrix → `configuration.md#logging`.
9. `## Changing the configuration` — from legacy L196: changes are read at startup only, so restart or reload the MCP server in your client before expecting them to take effect.

- [ ] **Step 3: Verify**

Run: `node scripts/check-docs.mjs`
Expected: zero hard errors; `setup-local.md` no longer in the pending list.

- [ ] **Step 4: Verify the documented startup message matches the source**

Run: `grep -rn "running on stdio" src/index.ts`
Expected: `src/index.ts:446` — `console.error('Dynatrace Managed MCP Server running on stdio')`. Confirm the doc quotes this string exactly and says stderr.

- [ ] **Step 5: Format and lint**

Run: `npx prettier --write docs/setup-local.md && npx markdownlint-cli2 docs/setup-local.md`
Expected: `Summary: 0 issues`

- [ ] **Step 6: Commit**

```bash
git add docs/setup-local.md
git commit -m "NOISSUE(docs): add local (stdio) setup guide

One complete path for local mode, including the startup-validation
behaviour that makes local misconfiguration fail visibly, and a standalone
verification step that separates server problems from client config problems.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Remote (HTTP) setup hub

The largest content task. Carries defects 1 and 6 and gathers material the legacy README had scattered across three sections.

**Files:**

- Create: `docs/setup-remote.md`

**Interfaces:**

- Consumes: `docs/api-token.md`, `docs/configuration.md`, the client pages.
- Produces: anchors `#how-authentication-works` and `#limits-and-tuning`, linked by Tasks 7–9 and 12.

- [ ] **Step 1: Confirm the link is pending**

Run: `node scripts/check-docs.mjs 2>&1 | grep setup-remote`
Expected: `README.md: link target does not exist -> docs/setup-remote.md`

- [ ] **Step 2: Write `docs/setup-remote.md`**

Migration sources: legacy L214–237 (auth), L239–258 (limits), L406–444 (flags and client config — **defect 1 lives at L425–427**), plus `docs/DEVELOPMENT.md:70–80` (curl smoke test) and `.github/workflows/release.yml` (image name).

Structure:

1. `# Remote setup (HTTP)` — when to use it: one shared server for a team, each member authenticating with their own token; also stateful hosting, load balancing and web clients (legacy L410).
2. `## How authentication works` — from legacy L214–237. The server holds **no** tokens. Every request carries the caller's per-environment tokens in one header:

   ```text
   X-Dynatrace-Tokens: prod=dt0c01.AAA;staging=dt0c01.BBB
   ```

   The server uses the caller's token for the environment named by `environment_alias`, so each user sees only what their token permits; a request targeting an environment with no supplied token is rejected naming the missing alias. Add the three facts the legacy README omitted:
   - There is **no startup validation** in HTTP mode — the opposite of local mode. A wrong URL or bad token surfaces per request as `401 Unauthorized: no valid Dynatrace token supplied`, not as a startup failure [`src/index.ts:325`].
   - Token validity is cached for 60 s by default; tune with `DT_MCP_TOKEN_VALIDATION_TTL_MS`.
   - Rate limiting buckets per caller, keyed by the token header — link `configuration.md#rate-limiting`.

3. `## 1. Write the environment configuration` — a `[!IMPORTANT]` callout: in HTTP mode the config must **omit `apiToken`**; only non-secret connection details belong in it, which is why it is safe to commit [`src/index.ts:111`]. Show `examples/dt-config-http.yaml` content and link the file.
4. `## 2. Run the server` — three subsections.
   - **Docker (recommended).** The published image, which the legacy README never mentioned — multi-arch `linux/amd64` and `linux/arm64`, cosign-signed:

     ````markdown
     ```bash
     docker run --rm -p 3000:3000 \
       -v ~/.dynatrace/managed-mcp-http.yaml:/config/dt-config.yaml:ro \
       -e DT_CONFIG_FILE=/config/dt-config.yaml \
       ghcr.io/dynatrace-oss/dynatrace-managed-mcp:latest \
       node dist/index.js --http --host 0.0.0.0 --port 3000
     ```
     ````

     Immediately follow with a `[!WARNING]`: `--host` defaults to `127.0.0.1` [`src/index.ts:101`], so a container started **without** `--host 0.0.0.0` accepts no connections from outside itself. This is the most common first-attempt failure.

   - **Docker Compose.** An equivalent `compose.yaml` with the same volume mount, `command:`, and a `ports:` mapping.
   - **Kubernetes.** A `Deployment` (one container, the image above, `--http --host 0.0.0.0`, the config supplied as a `ConfigMap` volume — no `Secret` needed, since the config holds no tokens), a `Service` on port 3000, and an `Ingress` with TLS. Label the block: these manifests are a starting point to adapt to your cluster's conventions, not a verified deployment.
   - Also document the flags for running without a container: `--http` (or its alias `--server`), `-p, --port <number>` (default `3000`), `-H, --host <host>` (default `127.0.0.1`), `--version`, `--help` [`src/index.ts:98–102`]. Every `npx` example here must use `@dynatrace-oss/dynatrace-managed-mcp-server` — legacy L425–427 used the SaaS package name and is **defect 1**.

5. `## 3. Put TLS in front` — a `[!WARNING]`: tokens travel in a request header, and the server does not terminate TLS [legacy L228–230]. Terminate TLS at a reverse proxy and never expose the server directly. An nginx `server` block: `listen 443 ssl`, certificate paths, `proxy_pass http://127.0.0.1:3000`, and `large_client_header_buffers 4 32k` with a pointer to the limits section.
6. `## 4. Smoke-test it` — adapted from `docs/DEVELOPMENT.md:70–80`. Note both headers are required — `Accept` must list `application/json` and `text/event-stream`:

   ````markdown
   ```bash
   curl -s -X POST http://127.0.0.1:3000/ \
     -H 'Content-Type: application/json' \
     -H 'Accept: application/json, text/event-stream' \
     -H 'X-Dynatrace-Tokens: production=dt0c01.YOUR_TOKEN' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
   ```
   ````

   Expected: a JSON-RPC result listing the tools. Then the two diagnostic cases: omitting the header returns `401` with `no valid Dynatrace token supplied`; an unparseable body returns JSON-RPC error `-32700`.

7. `## 5. Connect your client` — the four-row client table (each client page has a remote section) plus `examples/mcp-config-http.json` as the generic shape.
8. `## Limits and tuning` — from legacy L239–258. Each `X-Dynatrace-Tokens` entry is roughly 110 characters; Node's default 16 KB header limit fits about 140–150 environments. Raise it with `node --max-http-header-size=65536 ./dist/index.js --http`. A reverse proxy enforces its own limit — nginx defaults to 8 KB (about 70 environments), raised with `large_client_header_buffers 4 32k`. Also cover `DT_MCP_MAX_BODY_SIZE` (1 MB default, `413` beyond) and link `configuration.md#environment-variables`.

- [ ] **Step 3: Verify no SaaS package name crept in**

Run: `node scripts/check-docs.mjs`
Expected: zero hard errors. Had defect 1 been copied across, the forbidden-string guard would fire here.

- [ ] **Step 4: Verify the documented flags match the CLI**

Run: `npm run build && node ./dist/index.js --help`
Expected: output lists `--http`, `--server`, `-p, --port` (default 3000), `-H, --host` (default 127.0.0.1). Every flag documented in the page must appear here, and vice versa.

- [ ] **Step 5: Verify the 401 path against a running server**

```bash
node ./dist/index.js --http --port 3123 &
sleep 2
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3123/ \
  -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
kill %1
```

Expected: `401`. This requires a config with at least one environment present via `DT_CONFIG_FILE` or `DT_ENVIRONMENT_CONFIGS`; use a dummy entry with a fake URL and no token — HTTP mode does not validate at startup, which is exactly the documented behaviour. If the server exits instead of listening, the documented "no startup validation" claim is wrong and must be corrected.

- [ ] **Step 6: Format and lint**

Run: `npx prettier --write docs/setup-remote.md && npx markdownlint-cli2 docs/setup-remote.md`
Expected: `Summary: 0 issues`

- [ ] **Step 7: Commit**

```bash
git add docs/setup-remote.md
git commit -m "NOISSUE(docs): add remote (HTTP) setup guide

Gathers material the README had split across three distant sections and
adds what was missing: the published ghcr.io image, docker/compose/k8s
deployment, the required TLS reverse proxy, and a curl smoke test.

Fixes the instruction to run @dynatrace-oss/dynatrace-mcp-server (the SaaS
package). Documents that --host defaults to 127.0.0.1, so a container
without --host 0.0.0.0 is unreachable.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Claude Code client guide

Establishes the five-part skeleton that Tasks 8 and 9 reuse.

**Files:**

- Create: `docs/clients/claude-code.md`

**Interfaces:**

- Consumes: `docs/api-token.md`, `docs/setup-local.md`, `docs/setup-remote.md`, `docs/configuration.md`. Note the `../` prefix — client pages sit one directory deeper.
- Produces: the five-heading skeleton `## Prerequisites`, `## Add the server (local)`, `## Add the server (remote)`, `## Verify`, `## Notes and logs`. Tasks 8 and 9 must use these same five headings in this order.

- [ ] **Step 1: Confirm the link is pending**

Run: `node scripts/check-docs.mjs 2>&1 | grep claude-code`
Expected: `README.md: link target does not exist -> docs/clients/claude-code.md`

- [ ] **Step 2: Write `docs/clients/claude-code.md`**

The commands below were verified against the installed `claude mcp add`. Relative links from this file need `../`.

1. `# Claude Code`
2. `## Prerequisites` — an API token ([`../api-token.md`](../api-token.md)) and `~/.dynatrace/managed-mcp.yaml` ([`../setup-local.md`](../setup-local.md)).
3. `## Add the server (local)` — the CLI route first:

   ````markdown
   ```bash
   claude mcp add dynatrace-managed --scope project \
     -e DT_CONFIG_FILE=~/.dynatrace/managed-mcp.yaml \
     -- npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest
   ```
   ````

   Explain `--scope`: `local` (default, this project, only you), `project` (committed to `.mcp.json`, shared with the team), `user` (all your projects). Recommend `project` for a repo whose team shares one Managed environment, `user` for personal use across repos. Then the equivalent `.mcp.json` for hand-editing or committing:

   ````markdown
   ```json
   {
     "mcpServers": {
       "dynatrace-managed": {
         "command": "npx",
         "args": ["-y", "@dynatrace-oss/dynatrace-managed-mcp-server@latest"],
         "env": {
           "DT_CONFIG_FILE": "~/.dynatrace/managed-mcp.yaml"
         }
       }
     }
   }
   ```
   ````

   Add: committing `.mcp.json` is safe because it names the config file rather than containing a token — keep `~/.dynatrace/managed-mcp.yaml` out of the repo.

4. `## Add the server (remote)`:

   ````markdown
   ```bash
   claude mcp add --transport http dynatrace-managed https://mcp.internal.example.com/ \
     --header "X-Dynatrace-Tokens: production=dt0c01.YOUR_TOKEN"
   ```
   ````

   One line on the header format (`alias=token`, semicolon-separated) linking `../setup-remote.md#how-authentication-works`.

5. `## Verify` — run `/mcp` in Claude Code; the server appears as `dynatrace-managed` with its tools listed. Then ask `Ask Dynatrace to list problems`. Also `claude mcp list` to confirm registration.
6. `## Notes and logs` — `claude mcp remove dynatrace-managed` to undo; configuration changes need the server reconnected; for server-side logs set `LOG_OUTPUT=stderr-all` and `LOG_LEVEL=debug` in the `env` block, linking `../configuration.md#logging`.

- [ ] **Step 3: Verify**

Run: `node scripts/check-docs.mjs`
Expected: zero hard errors; no pending link for `claude-code.md`. Any `../` mistake shows up here as a broken target.

- [ ] **Step 4: Verify the CLI flags exist**

Run: `claude mcp add --help`
Expected: lists `-e, --env`, `-s, --scope` with values `local, user, project`, `-t, --transport` with `stdio, sse, http`, and `-H, --header`. If `claude` is unavailable, note it in the commit message and leave the snippets as written — they are transcribed from this help output.

- [ ] **Step 5: Format and lint**

Run: `npx prettier --write docs/clients/claude-code.md && npx markdownlint-cli2 docs/clients/claude-code.md`
Expected: `Summary: 0 issues`

- [ ] **Step 6: Commit**

```bash
git add docs/clients/claude-code.md
git commit -m "NOISSUE(docs): add Claude Code client guide

First-class setup for Claude Code, which the README never covered, with
both local and remote registration. Establishes the five-section skeleton
the other client guides follow.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: GitHub Copilot client guides

**Files:**

- Create: `docs/clients/vs-code-copilot.md`
- Create: `docs/clients/copilot-cli.md`

**Interfaces:**

- Consumes: the five-heading skeleton from Task 7; `../setup-local.md`, `../setup-remote.md`, `../configuration.md`, `../api-token.md`.
- Produces: nothing consumed by later tasks beyond the README links already declared.

- [ ] **Step 1: Confirm both links are pending**

Run: `node scripts/check-docs.mjs 2>&1 | grep -E "vs-code-copilot|copilot-cli"`
Expected: two pending-link lines.

- [ ] **Step 2: Write `docs/clients/vs-code-copilot.md`**

Migration source: legacy L303–333. Use the Task 7 skeleton.

Open with one clarifying sentence, because this confuses people: in VS Code, GitHub Copilot **is** the MCP client — servers are declared in `.vscode/mcp.json` and used by Copilot Chat in agent mode.

- `## Prerequisites` — token, config file, and Copilot Chat with agent mode enabled. Keep the workspace-settings snippet from `docs/DEVELOPMENT.md:173–186` (`"github.copilot.enable": { "*": true }`) and reference `assets/copilot-enable-agent-mode.gif`, which currently ships unused in the repo.
- `## Add the server (local)` — `.vscode/mcp.json`, note the `servers` key (not `mcpServers`):

  ````markdown
  ```json
  {
    "servers": {
      "dynatrace-managed": {
        "command": "npx",
        "args": ["-y", "@dynatrace-oss/dynatrace-managed-mcp-server@latest"],
        "env": {
          "DT_CONFIG_FILE": "~/.dynatrace/managed-mcp.yaml"
        }
      }
    }
  }
  ```
  ````

  Then the two variants from legacy L310–319: `"cwd": "${workspaceFolder}"` and `"envFile": "${workspaceFolder}/.env"` work **only** when the config lives in the workspace (`<your-repo>/.vscode/mcp.json`), not in user settings — [the predefined-variables reference](https://code.visualstudio.com/docs/reference/variables-reference#_predefined-variables). Recommend `env` with `DT_CONFIG_FILE` for a user-level setup, since `~` is expanded by the server and needs no workspace variable.

- `## Add the server (remote)` — the `type`/`url`/`headers` form:

  ````markdown
  ```json
  {
    "servers": {
      "dynatrace-managed": {
        "type": "http",
        "url": "https://mcp.internal.example.com/",
        "headers": {
          "X-Dynatrace-Tokens": "production=dt0c01.YOUR_TOKEN"
        }
      }
    }
  }
  ```
  ````

- `## Verify` — start the server from the `mcp.json` gutter action, open Copilot Chat in agent mode, check the tools picker lists the Dynatrace tools, then ask `Ask Dynatrace to list problems`.
- `## Notes and logs` — recommend `LOG_OUTPUT=stderr-all` so logs appear in the Output panel (legacy L515 calls this the recommended VS Code setting); reload the server after config changes; prefer workspace over global configuration (legacy L301).

- [ ] **Step 3: Write `docs/clients/copilot-cli.md`**

Same skeleton. Two content requirements:

- The registration syntax and config-file location **must be verified against current GitHub Copilot CLI documentation at implementation time** — the spec flags this as unverifiable here, and no Copilot CLI is installed. Do not transcribe from memory. Fetch the current docs, then write the local (stdio) and remote (HTTP) forms.
- `## Notes and logs` must carry the compatibility note, which is specific to this client: Copilot CLI's model API rejects tool schemas containing `$schema` or `additionalProperties: false`, so the server strips both from `tools/list` responses [`src/utils/mcp-compat.ts`]. Versions before this workaround failed against Copilot CLI with a `400 Bad Request`, so run `@latest` or at least 1.0.1. Also note the server sets `enableJsonResponse` so clients that cannot hold a persistent SSE stream still work [`src/index.ts:375`].

If the current syntax cannot be established, stop and report rather than guessing — a wrong command here is worse than a pointer to GitHub's docs.

- [ ] **Step 4: Verify**

Run: `node scripts/check-docs.mjs`
Expected: zero hard errors; neither file pending.

- [ ] **Step 5: Format and lint**

Run: `npx prettier --write docs/clients/vs-code-copilot.md docs/clients/copilot-cli.md && npx markdownlint-cli2 docs/clients/vs-code-copilot.md docs/clients/copilot-cli.md`
Expected: `Summary: 0 issues`

- [ ] **Step 6: Commit**

```bash
git add docs/clients/vs-code-copilot.md docs/clients/copilot-cli.md
git commit -m "NOISSUE(docs): add GitHub Copilot client guides

VS Code + Copilot agent mode and Copilot CLI, both with local and remote
setup. Explains that in VS Code Copilot is the MCP client, and records the
Copilot CLI schema constraint that src/utils/mcp-compat.ts works around.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Claude Desktop and other clients

Carries defect 3 and closes defect 4.

**Files:**

- Create: `docs/clients/claude-desktop.md`
- Create: `docs/clients/other-clients.md`

**Interfaces:**

- Consumes: the Task 7 skeleton and the shared links.
- Produces: the final two client link targets from the README table.

- [ ] **Step 1: Confirm both links are pending**

Run: `node scripts/check-docs.mjs 2>&1 | grep -E "claude-desktop|other-clients"`
Expected: two pending-link lines.

- [ ] **Step 2: Write `docs/clients/claude-desktop.md`**

Migration source: legacy L335–349, converted to the `DT_CONFIG_FILE` form. Task 7 skeleton.

- `## Prerequisites` — token and config file.
- `## Add the server (local)` — the config file path per OS: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`, Linux `~/.config/Claude/claude_desktop_config.json`. Then the `mcpServers` snippet (same shape as Task 7's `.mcp.json`, `mcpServers` key).
- `## Add the server (remote)` — the `type`/`url`/`headers` form, matching `examples/mcp-config-http.json`.
- `## Verify` — fully quit and reopen Claude Desktop (a window close is not enough), check the tools indicator, ask `Ask Dynatrace to list problems`.
- `## Notes and logs` — Claude Desktop must be restarted after any config change; server logs go to the log file by default, linking `../configuration.md#logging`.

- [ ] **Step 3: Write `docs/clients/other-clients.md`**

Migration sources: legacy L351–369 (Kiro), L371–404 (Gemini CLI). This page closes **defect 4** — the README advertised these clients with no instructions — so every client named in the README must appear here with a real snippet.

Open with one line: these clients all speak MCP; the snippet shape is the same, only the file location differs. Then one `##` section per client, each with its config path and a snippet using `DT_CONFIG_FILE`:

- **Cursor** — `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global), `mcpServers` key.
- **Windsurf** — `~/.codeium/windsurf/mcp_config.json`, `mcpServers` key.
- **Kiro** — `<project-root>/.kiro/settings/mcp.json` or `~/.kiro/settings/mcp.json` (legacy L369), `mcpServers` key. Keep the legacy L353 description and links.
- **Gemini CLI** — `~/.gemini/settings.json` or `.gemini/settings.json`, `mcpServers` key, keeping `"timeout": 30000` and `"trust": false` from legacy L399–400. **Defect 3:** do **not** include `gemini extensions install <repo>` — this repository ships no `gemini-extension.json`, so that command cannot work. Verify `gemini mcp list` as the check.
- **ChatGPT** — MCP connector support and its configuration surface **must be verified against current OpenAI documentation at implementation time**; the spec flags this as unverifiable here. If it cannot be confirmed, say plainly that it is untested with this server and link OpenAI's documentation rather than inventing a snippet.

Close with: a client not listed here works if it speaks MCP — use the shape above with your client's config path, and open an issue if you would like it documented.

- [ ] **Step 4: Verify defect 3 is gone and defect 4 is closed**

Run: `node scripts/check-docs.mjs`
Expected: zero hard errors — the `gemini extensions install` guard would fire otherwise.

Run: `for c in Cursor Windsurf Kiro Gemini ChatGPT; do printf '%s: ' "$c"; grep -c "$c" docs/clients/other-clients.md; done`
Expected: a non-zero count for each. Every client the README advertises now has instructions.

- [ ] **Step 5: Format and lint**

Run: `npx prettier --write docs/clients/claude-desktop.md docs/clients/other-clients.md && npx markdownlint-cli2 docs/clients/claude-desktop.md docs/clients/other-clients.md`
Expected: `Summary: 0 issues`

- [ ] **Step 6: Commit**

```bash
git add docs/clients/claude-desktop.md docs/clients/other-clients.md
git commit -m "NOISSUE(docs): add Claude Desktop and other client guides

Every client the README advertises now has real setup instructions.
Removes the 'gemini extensions install' instruction, which could not work:
this repository ships no gemini-extension.json.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Overview

Reference-only content, off the critical path. Mostly a faithful move.

**Files:**

- Create: `docs/overview.md`

**Interfaces:**

- Consumes: README link `docs/overview.md`.
- Produces: nothing later tasks depend on beyond that link.

- [ ] **Step 1: Confirm the link is pending**

Run: `node scripts/check-docs.mjs 2>&1 | grep overview`
Expected: `README.md: link target does not exist -> docs/overview.md`

- [ ] **Step 2: Write `docs/overview.md`**

Migration sources: legacy L204–212 (architecture), L260–276 (use cases), L277–286 (capability detail), L287–295 (performance), L640–648 (SaaS differences).

1. `# Overview`
2. `## Use cases` — the two deployment scenarios and six bullets from legacy L262–275, unchanged. Where the second scenario mentions the SaaS MCP, link `hybrid-saas-managed.md`.
3. `## Capabilities` — the seven capability bullets from legacy L279–285 with their Dynatrace Hub links. Note that these use the v2 REST APIs and incur no cost beyond the standard Managed licence (legacy L200).
4. `## Architecture` — both images, paths adjusted for the `docs/` location:

   ```markdown
   ### Local mode

   ![Architecture (local mode)](../assets/dynatrace-managed-mcp-arch-local.png?raw=true)

   ### Remote mode

   ![Architecture (remote mode)](../assets/dynatrace-managed-mcp-arch-remote.png?raw=true)
   ```

   One sentence under each linking `setup-local.md` and `setup-remote.md`.

5. `## Performance considerations` — legacy L289–295, unchanged: narrow time ranges, specific entity selectors, and the multiplication effect of querying many environments at once.
6. `## How this differs from the SaaS MCP` — legacy L642–648: this server targets Managed; the SaaS server is at `https://github.com/dynatrace-oss/dynatrace-mcp`; SaaS uses DQL where Managed uses the v2 APIs; SaaS has Davis CoPilot, Managed does not; SaaS uses OAuth, Managed uses API tokens. Link `hybrid-saas-managed.md`.

- [ ] **Step 3: Verify the image links resolve**

Run: `node scripts/check-docs.mjs 2>&1 | grep -i assets`
Expected: no output — a wrong `../` on an image path would appear here.

- [ ] **Step 4: Format and lint**

Run: `npx prettier --write docs/overview.md && npx markdownlint-cli2 docs/overview.md`
Expected: `Summary: 0 issues`

- [ ] **Step 5: Commit**

```bash
git add docs/overview.md
git commit -m "NOISSUE(docs): add overview with use cases and architecture

Moves the why/what content off the setup critical path: use cases,
both architecture diagrams, performance guidance, and how this server
differs from the SaaS MCP.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Multi-environment and hybrid guides

Resolves the legacy duplication: rule-file guidance appeared at L446 and again at L665, and the four steering templates were mixed together regardless of topic.

**Files:**

- Create: `docs/multi-environment.md`
- Create: `docs/hybrid-saas-managed.md`

**Interfaces:**

- Consumes: README links; `docs/configuration.md#proxy`; `docs/overview.md`.
- Produces: anchor `#rule-files`, linked by `docs/multi-environment.md` from `hybrid-saas-managed.md` and by Task 13's index.

- [ ] **Step 1: Confirm both links are pending**

Run: `node scripts/check-docs.mjs 2>&1 | grep -E "multi-environment|hybrid"`
Expected: two pending-link lines.

- [ ] **Step 2: Write `docs/multi-environment.md`**

Migration sources: legacy L446–488 (rule file + EasyTrade example — move as-is, it is good content), L674–695 (the multi-Managed steering template), L611 (per-environment proxy note), L194 (the recommendation to use rules with multiple environments).

1. `# Multiple environments` — the server queries several Managed environments from one instance; you address them by `alias`.
2. `## Aliases` — choose stable, meaningful aliases (`production`, `staging`) because that is how you and the assistant refer to environments. Note `ALL_ENVIRONMENTS` queries every configured environment and that aliases can be combined with `;` [`src/index.ts:269–278`]. Warn about response volume: top 10 problems across 10 environments is 100 problems into the model's context (legacy L295).
3. `## Rule files` — legacy L448–452 plus the full EasyTrade example from L456–488, unchanged, including the entity-selector examples. Keep the links to Copilot repository instructions and Amazon Q rules.
4. `## Steering for multiple Managed environments` — the production/test/development template from legacy L678–695, unchanged, with the legacy L676 advice to refer to environments by the same alias used in the config.
5. `## Per-environment proxies` — one paragraph: proxies are set per environment, so one environment can route through a proxy while another does not (legacy L611). Link `configuration.md#proxy` for the fields and the two warnings.
6. `## Also running the SaaS MCP?` — one line linking `hybrid-saas-managed.md`.

- [ ] **Step 3: Write `docs/hybrid-saas-managed.md`**

Migration sources: legacy L650–663 (the hybrid explanation), L697–713 (migration-date template), L715–732 (running-in-tandem template).

1. `# Running alongside the Dynatrace SaaS MCP` — legacy L652: both servers can run at once, for genuinely hybrid estates and for migrations where historical data stays on Managed.
2. `## Setting it up` — the four steps from legacy L654–659: set up this server; set up the SaaS server from `https://github.com/dynatrace-oss/dynatrace-mcp` giving the two servers **different names** in your MCP config; confirm your assistant sees both; add steering rules.
3. `## Why steering matters` — legacy L663: without rules, `Ask Dynatrace to list application problems from the last 24 hours` may hit either server or both depending on context. Either be very specific in the prompt, or add rules.
4. `## Steering: after a migration` — the migration-date template from legacy L702–713, unchanged.
5. `## Steering: running in tandem` — the split-estate template from legacy L720–732, unchanged.
6. Close with a line linking `multi-environment.md#rule-files` for where rule files live per assistant.

- [ ] **Step 4: Verify the duplication is gone**

Run: `node scripts/check-docs.mjs`
Expected: zero hard errors; neither file pending.

Run: `grep -rc "easytrade" docs/multi-environment.md docs/hybrid-saas-managed.md`
Expected: a non-zero count for `multi-environment.md` and `0` for `hybrid-saas-managed.md` — the rule-file example lives in exactly one place.

- [ ] **Step 5: Format and lint**

Run: `npx prettier --write docs/multi-environment.md docs/hybrid-saas-managed.md && npx markdownlint-cli2 docs/multi-environment.md docs/hybrid-saas-managed.md`
Expected: `Summary: 0 issues`

- [ ] **Step 6: Commit**

```bash
git add docs/multi-environment.md docs/hybrid-saas-managed.md
git commit -m "NOISSUE(docs): split multi-environment and hybrid SaaS guidance

The README documented rule files twice (L446 and L665) with four steering
templates mixed together. Each template now sits with the scenario it
serves, and the rule-file example exists once.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Troubleshooting

Carries defect 2. Mostly net-new: the legacy section was 13 lines with a broken code fence.

**Files:**

- Create: `docs/troubleshooting.md`

**Interfaces:**

- Consumes: README, both setup hubs, `docs/api-token.md`, `docs/configuration.md`.
- Produces: the link target referenced by the README quickstart and both setup hubs.

- [ ] **Step 1: Confirm the link is pending**

Run: `node scripts/check-docs.mjs 2>&1 | grep troubleshooting`
Expected: pending-link lines from README and the setup hubs.

- [ ] **Step 2: Collect the exact error strings from the source**

Run:

```bash
grep -rn "No valid environments found\|Failed to get managed environments\|Unauthorized: no valid\|Rate limit exceeded\|Request Entity Too Large\|running on stdio" src/*.ts src/**/*.ts | grep -v __tests__
```

Expected: hits in `src/index.ts` (lines ~118–128, 187, 331, 356, 446). Quote these strings verbatim in the page so a customer searching their error text finds the fix.

- [ ] **Step 3: Write `docs/troubleshooting.md`**

Migration source: legacy L738–750, expanded. Note **defect 2**: legacy L748 nested an indented block inside a fence, which renders broken — use a plain fenced block.

1. `# Troubleshooting` — start with the highest-yield step: run the server standalone, outside your client, and read the output. Link `setup-local.md#verify-the-server-starts`.
2. `## Start here` — the standalone command, then: if it prints `Dynatrace Managed MCP Server running on stdio` your configuration and token are fine and the problem is in the client config; if it exits, the error text names the cause.

   ````markdown
   ```bash
   DT_CONFIG_FILE=~/.dynatrace/managed-mcp.yaml \
     npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest
   ```
   ````

3. `## Common problems` — one `###` subsection per row below, each with symptom, cause and fix:

   | Symptom                                                     | Cause and fix                                                                                                                                                                                                                                                                                                   |
   | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `EBADENGINE` during install                                 | Node outside `>=26.5.1 <27`. Install a supported version.                                                                                                                                                                                                                                                       |
   | Exits 1 with `No valid environments found, stopping.`       | stdio startup validation reached the cluster but no environment validated — usually a wrong `apiEndpointUrl`, a missing `environmentId`, or a token lacking scopes. Check [required scopes](api-token.md#required-scopes).                                                                                      |
   | `Failed to get managed environments configurations`         | The config file is missing, unreadable, or malformed, or `DT_CONFIG_FILE` points at the wrong place. Remember relative paths resolve against the client's working directory — prefer `~` or absolute.                                                                                                           |
   | `401 Unauthorized: no valid Dynatrace token supplied`       | HTTP mode only: the `X-Dynatrace-Tokens` header is absent, malformed, or holds no token valid for any configured environment. Format is `alias=token;alias=token` and the aliases must match the config exactly. Validity is cached 60 s, so retry after a token fix or lower `DT_MCP_TOKEN_VALIDATION_TTL_MS`. |
   | `Rate limit exceeded: Maximum N tool calls per M seconds`   | Raise `DT_MCP_RATE_LIMIT_MAX_CALLS` / `DT_MCP_RATE_LIMIT_WINDOW_MS`, or narrow the question. Limits are per caller.                                                                                                                                                                                             |
   | `413 Request Entity Too Large`                              | HTTP mode: request body over `DT_MCP_MAX_BODY_SIZE` (1 MB default).                                                                                                                                                                                                                                             |
   | `Mcp error: -32002: connection closed: initialize response` | The server failed to start. Run it standalone — legacy L740–750.                                                                                                                                                                                                                                                |
   | `Transport closed` on a tool call                           | Something wrote to stdout, which stdio reserves for the protocol. Ensure `LOG_OUTPUT` is not a stdout variant; use `stderr-all` or `file`.                                                                                                                                                                      |
   | Remote server unreachable from another machine              | `--host` still `127.0.0.1`. Start with `--host 0.0.0.0` — see [remote setup](setup-remote.md).                                                                                                                                                                                                                  |
   | Requests fail once many environments are configured         | `X-Dynatrace-Tokens` exceeded a header size limit. See [limits and tuning](setup-remote.md#limits-and-tuning).                                                                                                                                                                                                  |
   | A configured proxy appears to be ignored                    | `HTTP_PROXY`/`HTTPS_PROXY` are **not** read by this server; use the per-environment `httpProxyUrl`/`httpsProxyUrl` fields. Setting both on one environment disables the proxy — see [proxy](configuration.md#proxy).                                                                                            |
   | Assistant answers about the wrong environment               | Add steering rules — see [multiple environments](multi-environment.md) or, alongside the SaaS server, [hybrid setup](hybrid-saas-managed.md).                                                                                                                                                                   |
   | Config changes have no effect                               | Configuration is read at startup. Restart or reconnect the server in your client.                                                                                                                                                                                                                               |

4. `## Getting more detail` — set `LOG_LEVEL=debug` with `LOG_OUTPUT=stderr-all` (or `file`, then `tail -f dynatrace-managed-mcp.log`). Ask the assistant to report the exact error the MCP returned; for startup problems check the client's own MCP logs. Link `configuration.md#logging`.
5. `## Still stuck` — open a GitHub issue with the server version (`npx ... --version`), the client, the mode, and the debug log with tokens redacted.

- [ ] **Step 4: Verify the fence renders and links resolve**

Run: `npx markdownlint-cli2 docs/troubleshooting.md`
Expected: `Summary: 0 issues` — an indented block inside a fence, the legacy defect, trips `MD046`/`MD031`.

Run: `node scripts/check-docs.mjs`
Expected: zero hard errors; `troubleshooting.md` no longer pending.

- [ ] **Step 5: Format**

Run: `npx prettier --write docs/troubleshooting.md`
Expected: no diff on a second run.

- [ ] **Step 6: Commit**

```bash
git add docs/troubleshooting.md
git commit -m "NOISSUE(docs): add troubleshooting guide keyed to real error strings

Replaces 13 lines (with a broken code fence) with symptom-cause-fix
entries quoting the strings the server actually emits, so a customer can
search their error text.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Docs index, cross-links, and the final gate

Closes the loop: the index, the cross-links from files outside the new set, the strict verification run, and an audit that all 778 legacy lines were accounted for.

**Files:**

- Create: `docs/README.md`
- Modify: `docs/DEVELOPMENT.md` (cross-links only)
- Modify: `examples/README.md` (one added link)

**Interfaces:**

- Consumes: every page from Tasks 2–12.
- Produces: `node scripts/check-docs.mjs --strict` passing with zero pending links — the definition of done.

- [ ] **Step 1: Write `docs/README.md`**

A pure index, no prose of its own beyond one opening line. A table with every guide and a one-line description, grouped: **Getting started** (`api-token.md`, `setup-local.md`, `setup-remote.md`), **Clients** (the five pages), **Reference** (`configuration.md`, `multi-environment.md`, `hybrid-saas-managed.md`, `troubleshooting.md`, `overview.md`), **Contributing** (`DEVELOPMENT.md`, `../examples/README.md`). Link back to `../README.md`.

- [ ] **Step 2: Find the stale cross-links in `docs/DEVELOPMENT.md`**

Run: `grep -n "README.md#" docs/DEVELOPMENT.md`
Expected: hits at lines ~37 and ~38 pointing at `../README.md#api-scopes-for-managed-deployment` and `../README.md#environment-variables` — anchors that no longer exist after Task 2.

- [ ] **Step 3: Fix them**

Repoint to the new owners: `../README.md#api-scopes-for-managed-deployment` → `api-token.md#required-scopes`; `../README.md#environment-variables` → `configuration.md#environment-variables`. Then check the rest of the file for references to moved content — the Docker section (`DEVELOPMENT.md:134`) uses `DT_ENVIRONMENT_CONFIGS`, which is still valid, but add a pointer to `setup-remote.md` for the published image so contributors do not think a local build is the only option. Leave everything else untouched.

- [ ] **Step 4: Add one link to `examples/README.md`**

At the top, one line: `Setup instructions live in the [documentation index](../docs/README.md).` Change nothing else — the prompt cookbook keeps its content.

- [ ] **Step 5: Run the strict gate**

Run: `node scripts/check-docs.mjs --strict`
Expected: exit 0 and `Documentation checks passed (N files checked).` with **no pending links and no hard errors**. Any remaining pending link means a page references a path that was never created — fix the link or create the page.

- [ ] **Step 6: Audit the migration map**

Confirm every legacy section reached a destination. For each of the fourteen headings below, verify the content exists somewhere in the new set:

```bash
for t in "Configuration Methods" "Configuration Priority" "Configuration Fields" \
         "Architecture" "HTTP authentication" "Use cases" "Capabilities" \
         "Rule File" "Environment Variables" "Rate Limiting" "Proxy" \
         "Authentication" "Hybrid Setup" "Telemetry"; do
  printf '%-24s ' "$t"
  grep -rli "$t" README.md docs/*.md docs/clients/*.md | grep -v superpowers | tr '\n' ' '
  echo
done
```

Expected: every row names at least one file. An empty row is content lost in the move — recover it from `git show main:README.md`.

- [ ] **Step 7: Full repository verification**

Run: `npm run prettier && npx markdownlint-cli2 "**/*.md" "!node_modules" && npm run check:docs && npm run test:unit`
Expected: Prettier clean, `Summary: 0 issues`, docs checks passed, unit tests pass. The unit-test run confirms this documentation branch changed no behaviour.

- [ ] **Step 8: Confirm the README target**

Run: `wc -l README.md && git show main:README.md | wc -l`
Expected: roughly 170 versus 778.

- [ ] **Step 9: Commit**

```bash
git add docs/README.md docs/DEVELOPMENT.md examples/README.md
git commit -m "NOISSUE(docs): add docs index and fix cross-links

Adds the documentation index and repoints DEVELOPMENT.md at the new owners
of the scopes list and the environment-variable reference, whose README
anchors no longer exist.

All relative links, heading anchors, documented environment variables and
defect guards now pass under check-docs --strict.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 10: Open the pull request**

```bash
git push -u origin docs/restructure-documentation
```

Then open a PR describing: the 778 → ~170 line README, the new `docs/` structure, the eight corrected defects (calling out the proxy and `DT_API_ENDPOINT_URL` claims as ones that actively misled customers), and the three code-level follow-ups recorded in the spec that are deliberately **not** addressed here — the server not honouring `HTTP_PROXY`/`HTTPS_PROXY`, the silent proxy disable when both fields are set, and `server.json` marking `DT_ENVIRONMENT_CONFIGS` required while omitting `DT_CONFIG_FILE`.

---

## Self-Review

**1. Spec coverage.** Every spec section maps to a task: the ownership table → Tasks 2–13 (one file per task group); README contents → Task 2; `setup-local.md` → Task 5; `setup-remote.md` → Task 6; the client skeleton → Tasks 7–9; `troubleshooting.md` → Task 12; the migration map → the per-task "migration source" lines plus the Task 13 audit; all eight defects → Tasks 2 (4, 5), 4 (7, 8), 6 (1, 6), 9 (3), 12 (2); verification steps 1–9 → Task 1's checker plus the per-task gates, with step 6 (container) in Task 6 Step 5, step 7 (401) in Task 6 Step 5, step 8 (min version) in the checker, step 9 (DEVELOPMENT.md links) in Task 13 Step 2. Both known-unverifiable items are called out where they land, in Tasks 8 and 9, with an instruction to verify against upstream rather than guess. No gaps found.

**2. Placeholder scan.** No "TBD", "TODO", "similar to Task N", or "add appropriate error handling". The checker is given in full. Where a task migrates prose, it cites exact legacy line ranges and the specific correction rather than saying "rewrite as needed". Two tasks deliberately require live upstream lookup (Copilot CLI, ChatGPT) — that is a stated constraint from the spec, not a placeholder, and both include a stop-and-report instruction instead of a guess.

**3. Consistency check.** Path names are identical across the README table (Task 2), every consuming link, and the Task 13 index. The five client-page headings defined in Task 7 are reused verbatim in Tasks 8 and 9. Anchor targets produced by one task and consumed by another match: `api-token.md#required-scopes`, `configuration.md#configuration-fields`, `configuration.md#environment-variables`, `configuration.md#logging`, `configuration.md#rate-limiting`, `configuration.md#proxy`, `setup-local.md#verify-the-server-starts`, `setup-remote.md#how-authentication-works`, `setup-remote.md#limits-and-tuning`, `multi-environment.md#rule-files` — each is created by the task that owns the heading and only referenced afterwards. The config path `~/.dynatrace/managed-mcp.yaml` is identical in Tasks 2, 5, 7, 8, 9 and 12.

One issue found and fixed inline: Task 2's gate originally required a fully green checker, but `DT_MCP_MAX_BODY_SIZE` and `DT_MCP_TOKEN_VALIDATION_TTL_MS` cannot be documented until `configuration.md` exists in Task 4. Task 2 Step 3 now states the exact two permitted errors and forbids papering over them in the README, and Task 4 Step 1 asserts those same two errors are still open before closing them.
