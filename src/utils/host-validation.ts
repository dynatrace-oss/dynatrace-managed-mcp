const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];

const WILDCARD_BIND_ADDRESSES = new Set(['0.0.0.0', '::', '[::]']);

export interface HostValidationRejection {
  status: number;
  message: string;
}

export function isWildcardBindAddress(host: string | undefined): boolean {
  const normalized = normalizeHostname(host);
  return normalized !== undefined && WILDCARD_BIND_ADDRESSES.has(normalized);
}

export function normalizeHostname(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }

  const candidates = [trimmed];
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

function normalizeOriginHostname(origin: string): string | undefined {
  try {
    const { hostname } = new URL(origin.trim());
    return hostname === '' ? undefined : hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function parseAllowlistOverride(override: string | undefined): string[] {
  return (override ?? '')
    .split(',')
    .map((entry) => normalizeHostname(entry))
    .filter((entry): entry is string => entry !== undefined);
}

export function hasExplicitAllowlist(override: string | undefined): boolean {
  return parseAllowlistOverride(override).length > 0;
}

export function buildAllowedHostnames(boundHost: string | undefined, override?: string): ReadonlySet<string> {
  const fromOverride = parseAllowlistOverride(override);
  if (fromOverride.length > 0) {
    return new Set(fromOverride);
  }

  if (isWildcardBindAddress(boundHost)) {
    return new Set(LOOPBACK_HOSTNAMES);
  }

  const bound = normalizeHostname(boundHost);
  return new Set([...(bound ? [bound] : []), ...LOOPBACK_HOSTNAMES]);
}

function forDisplay(value: string): string {
  const collapsed = value.replace(/[\r\n]+/g, ' ').trim();
  return collapsed.length > 100 ? `${collapsed.slice(0, 100)}...` : collapsed;
}

export function validateRequestHeaders(
  hostHeader: string | undefined,
  originHeader: string | undefined,
  allowedHostnames: ReadonlySet<string>,
): HostValidationRejection | undefined {
  if (allowedHostnames.size === 0) {
    return { status: 403, message: 'Host validation is not configured' };
  }

  if (!hostHeader || hostHeader.trim() === '') {
    return { status: 403, message: 'Missing Host header' };
  }
  const hostname = normalizeHostname(hostHeader);
  if (!hostname) {
    return { status: 403, message: `Invalid Host header: ${forDisplay(hostHeader)}` };
  }
  if (!allowedHostnames.has(hostname)) {
    return { status: 403, message: `Invalid Host: ${forDisplay(hostname)}` };
  }

  if (originHeader !== undefined && originHeader.trim() !== '') {
    const originHostname = normalizeOriginHostname(originHeader);
    if (!originHostname || !allowedHostnames.has(originHostname)) {
      return { status: 403, message: `Invalid Origin: ${forDisplay(originHeader)}` };
    }
  }

  return undefined;
}
