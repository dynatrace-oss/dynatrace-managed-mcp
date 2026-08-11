/**
 * DNS rebinding protection for HTTP mode.
 *
 * A DNS rebinding attack works like this: the victim loads a page from an attacker-controlled
 * domain served on the same port this server listens on, then the attacker rebinds that domain
 * to 127.0.0.1. Because scheme, host and port still match the page's origin, the browser treats
 * the follow-up `fetch()` calls as same-origin — no CORS preflight, no CORS check. The only
 * remaining signal is that the `Host` header still carries the attacker's domain, so validating
 * it is what stops the attack.
 *
 * The MCP SDK exposes two opt-in mechanisms for this, neither of which fits here:
 *   - `allowedHosts` / `enableDnsRebindingProtection` on `StreamableHTTPServerTransport` are
 *     deprecated as of SDK 1.30.0 in favour of external middleware.
 *   - the bundled `hostHeaderValidation` middleware is Express-only (it calls
 *     `res.status().json()`), while this server runs on a raw `node:http` server.
 *
 * So we replicate the SDK middleware's semantics — port-agnostic hostname comparison, 403 with a
 * JSON-RPC error body — in a form that works with `node:http`.
 */

/** Hostnames that always mean "this machine", in the form `new URL().hostname` returns. */
const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Bind addresses that accept traffic on every interface. When bound to one of these, the bound
 * address says nothing about which `Host` values are legitimate, so the allowlist cannot be
 * derived and has to be supplied by the operator.
 */
const WILDCARD_BIND_ADDRESSES = ['0.0.0.0', '::', '[::]'];

/** Rejection details for a request that failed Host/Origin validation. */
export interface HostValidationRejection {
  status: number;
  message: string;
}

/** True when `host` is a wildcard bind address (`0.0.0.0`, `::`). */
export function isWildcardBindAddress(host: string | undefined): boolean {
  const normalized = normalizeHostname(host);
  return normalized !== undefined && WILDCARD_BIND_ADDRESSES.includes(normalized);
}

/**
 * Normalize a `Host`-header-style value (`example.com:3000`, `127.0.0.1`, `[::1]:3000`) to a
 * bare, lowercased hostname with the port stripped. Returns `undefined` if it cannot be parsed.
 *
 * Note that IPv6 comes back bracketed (`[::1]`), matching the SDK — an allowlist entry of `::1`
 * would never match, which is why callers should use the bracketed form.
 */
export function normalizeHostname(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }

  const candidates = [trimmed];
  // A bare IPv6 literal ('::1') is not a valid URL authority, but its bracketed form is. Accept
  // both so `--host ::1` behaves the same as `--host [::1]`.
  if (!trimmed.startsWith('[') && (trimmed.match(/:/g)?.length ?? 0) > 1) {
    candidates.push(`[${trimmed}]`);
  }

  for (const candidate of candidates) {
    try {
      const { hostname } = new URL(`http://${candidate}`);
      if (hostname !== '') {
        return hostname.toLowerCase();
      }
    } catch {
      // Not a parseable authority in this form — fall through to the next candidate.
    }
  }
  return undefined;
}

/** Parse the hostname out of an `Origin` header (a full origin such as `http://host:3000`). */
function normalizeOriginHostname(origin: string): string | undefined {
  try {
    const { hostname } = new URL(origin.trim());
    return hostname === '' ? undefined : hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Build the list of hostnames this server accepts in the `Host` header.
 *
 * `override` is a comma-separated operator-supplied list (`DT_MCP_ALLOWED_HOSTS`) and wins
 * outright when set. Otherwise the list is derived from the bound host plus the loopback names.
 *
 * Returns an empty array to mean "cannot be determined" — bound to a wildcard address with no
 * override — which callers treat as validation disabled.
 */
export function buildAllowedHostnames(boundHost: string | undefined, override?: string): string[] {
  const fromOverride = (override ?? '')
    .split(',')
    .map((entry) => normalizeHostname(entry))
    .filter((entry): entry is string => entry !== undefined);
  if (fromOverride.length > 0) {
    return [...new Set(fromOverride)];
  }

  if (isWildcardBindAddress(boundHost)) {
    return [];
  }

  const bound = normalizeHostname(boundHost);
  // Loopback names are safe to include even for a LAN bind: `Host` is derived from the URL the
  // browser was pointed at, so an attacker cannot keep their own origin while sending `localhost`.
  return [...new Set([...(bound ? [bound] : []), ...LOOPBACK_HOSTNAMES])];
}

/** Truncate attacker-controlled header values before they reach a response body or the log. */
function forDisplay(value: string): string {
  const collapsed = value.replace(/[\r\n]+/g, ' ').trim();
  return collapsed.length > 100 ? `${collapsed.slice(0, 100)}...` : collapsed;
}

/**
 * Validate the `Host` and `Origin` headers of an incoming request.
 *
 * Returns `undefined` when the request is acceptable, or the rejection to send back. An empty
 * `allowedHostnames` disables validation entirely (wildcard bind with no operator allowlist).
 */
export function validateRequestHeaders(
  hostHeader: string | undefined,
  originHeader: string | undefined,
  allowedHostnames: string[],
): HostValidationRejection | undefined {
  if (allowedHostnames.length === 0) {
    return undefined;
  }

  if (!hostHeader || hostHeader.trim() === '') {
    return { status: 403, message: 'Missing Host header' };
  }
  const hostname = normalizeHostname(hostHeader);
  if (!hostname) {
    return { status: 403, message: `Invalid Host header: ${forDisplay(hostHeader)}` };
  }
  if (!allowedHostnames.includes(hostname)) {
    return { status: 403, message: `Invalid Host: ${forDisplay(hostname)}` };
  }

  // Second layer. Non-browser MCP clients do not send `Origin`, so an absent one is normal and
  // allowed. A browser always sends it, and a DNS-rebound page still carries the attacker's
  // origin — so rejecting unknown origins blocks the attack independently of the Host check.
  if (originHeader !== undefined && originHeader.trim() !== '') {
    const originHostname = normalizeOriginHostname(originHeader);
    if (!originHostname || !allowedHostnames.includes(originHostname)) {
      return { status: 403, message: `Invalid Origin: ${forDisplay(originHeader)}` };
    }
  }

  return undefined;
}
