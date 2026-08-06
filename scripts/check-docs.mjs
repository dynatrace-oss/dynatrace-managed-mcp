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

// Fenced code blocks (``` or ~~~, optionally carrying a language tag like ```markdown)
// often contain illustrative headings and link syntax as example *content*, not real
// document structure. Blank them out before scanning for headings/links so they can't
// be mistaken for either. Line count is preserved in case of future line-based checks.
function stripFences(text) {
  return text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n^\1[ \t]*$/gm, (block) => block.replace(/[^\n]/g, ''));
}

const anchorCache = new Map();
function anchorsOf(file) {
  if (!anchorCache.has(file)) {
    const set = new Set();
    for (const line of stripFences(read(file)).split('\n')) {
      const m = /^#{1,6}\s+(.*)$/.exec(line);
      if (m) set.add(slugify(m[1]));
    }
    anchorCache.set(file, set);
  }
  return anchorCache.get(file);
}

for (const file of DOC_FILES) {
  const text = stripFences(read(file));
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
    // Root-relative paths ("/docs/x.md") are relative to the repo root, not the
    // filesystem root that node:path's resolve() would otherwise anchor them to.
    const resolved = path.startsWith('/') ? resolve(ROOT, path.slice(1)) : resolve(dirname(file), path);
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
