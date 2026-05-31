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
