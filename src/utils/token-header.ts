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

  for (const [index, pair] of raw.split(';').entries()) {
    const trimmed = pair.trim();
    if (trimmed === '') {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      logger.warn(`Skipping malformed X-Dynatrace-Tokens entry for alias #${index}`);
      continue;
    }
    const alias = trimmed.slice(0, eq).trim();
    const token = trimmed.slice(eq + 1).trim();
    if (alias === '' || token === '') {
      logger.warn(`Skipping malformed X-Dynatrace-Tokens entry for alias #${index}`);
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

  // Normalize so equivalent headers (whitespace/order) produce the same key.
  const map = new Map<string, string>();
  for (const pair of tokenHeaderValue.split(';')) {
    const trimmed = pair.trim();
    if (trimmed === '') continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const alias = trimmed.slice(0, eq).trim();
    const token = trimmed.slice(eq + 1).trim();
    if (alias === '' || token === '') continue;
    map.set(alias, token); // duplicate alias -> last value wins
  }

  const canonical = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([alias, token]) => `${alias}=${token}`)
    .join(';');

  return createHash('sha256').update(canonical).digest('hex');
}
