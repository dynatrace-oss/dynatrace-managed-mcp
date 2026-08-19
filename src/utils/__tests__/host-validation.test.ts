import {
  buildAllowedHostnames,
  hasExplicitAllowlist,
  isWildcardBindAddress,
  normalizeHostname,
  validateRequestHeaders,
} from '../host-validation';

describe('normalizeHostname', () => {
  it('strips the port', () => {
    expect(normalizeHostname('127.0.0.1:3000')).toBe('127.0.0.1');
    expect(normalizeHostname('example.com:8080')).toBe('example.com');
  });

  it('returns IPv6 in bracketed form, from either input form', () => {
    expect(normalizeHostname('[::1]:3000')).toBe('[::1]');
    expect(normalizeHostname('[::1]')).toBe('[::1]');
    expect(normalizeHostname('::1')).toBe('[::1]');
  });

  it('lowercases and trims', () => {
    expect(normalizeHostname('  LocalHost:3000 ')).toBe('localhost');
  });

  it('returns undefined for unusable values', () => {
    expect(normalizeHostname(undefined)).toBeUndefined();
    expect(normalizeHostname('')).toBeUndefined();
    expect(normalizeHostname('   ')).toBeUndefined();
    expect(normalizeHostname('/')).toBeUndefined();
  });
});

describe('isWildcardBindAddress', () => {
  it('detects wildcard binds', () => {
    expect(isWildcardBindAddress('0.0.0.0')).toBe(true);
    expect(isWildcardBindAddress('::')).toBe(true);
    expect(isWildcardBindAddress('[::]')).toBe(true);
  });

  it('does not flag concrete addresses', () => {
    expect(isWildcardBindAddress('127.0.0.1')).toBe(false);
    expect(isWildcardBindAddress('192.168.0.1')).toBe(false);
    expect(isWildcardBindAddress(undefined)).toBe(false);
  });
});

describe('buildAllowedHostnames', () => {
  it('derives loopback names for the default bind', () => {
    expect(buildAllowedHostnames('127.0.0.1')).toEqual(new Set(['127.0.0.1', 'localhost', '[::1]']));
  });

  it('includes a LAN bind address alongside loopback names', () => {
    expect(buildAllowedHostnames('192.168.0.1')).toEqual(new Set(['192.168.0.1', 'localhost', '127.0.0.1', '[::1]']));
  });

  it('falls back to loopback only for a wildcard bind with no override', () => {
    expect(buildAllowedHostnames('0.0.0.0')).toEqual(new Set(['localhost', '127.0.0.1', '[::1]']));
    expect(buildAllowedHostnames('::')).toEqual(new Set(['localhost', '127.0.0.1', '[::1]']));
  });

  it('never returns an empty list, so validation can never be silently disabled', () => {
    for (const boundHost of ['0.0.0.0', '::', '[::]', '127.0.0.1', '192.168.0.1', undefined, '', 'nonsense/host']) {
      expect(buildAllowedHostnames(boundHost, undefined).size).toBeGreaterThan(0);
      expect(buildAllowedHostnames(boundHost, '  ,  ').size).toBeGreaterThan(0);
    }
  });

  it('lets an override win, including for wildcard binds', () => {
    expect(buildAllowedHostnames('0.0.0.0', 'mcp.example.com')).toEqual(new Set(['mcp.example.com']));
    expect(buildAllowedHostnames('127.0.0.1', 'mcp.example.com')).toEqual(new Set(['mcp.example.com']));
  });

  it('parses, normalizes and dedupes override lists', () => {
    const deduped = buildAllowedHostnames('0.0.0.0', ' A.example.com:3000 , b.example.com , a.example.com ');
    expect(deduped).toEqual(new Set(['a.example.com', 'b.example.com']));
    expect(deduped.size).toBe(2);
  });

  it('ignores an override that contains nothing usable', () => {
    expect(buildAllowedHostnames('127.0.0.1', '  ,  ')).toEqual(new Set(['127.0.0.1', 'localhost', '[::1]']));
  });
});

describe('validateRequestHeaders', () => {
  const allowed = buildAllowedHostnames('127.0.0.1');

  it('accepts an allowed Host with no Origin (typical MCP client)', () => {
    expect(validateRequestHeaders('127.0.0.1:3000', undefined, allowed)).toBeUndefined();
    expect(validateRequestHeaders('localhost:3000', undefined, allowed)).toBeUndefined();
    expect(validateRequestHeaders('[::1]:3000', undefined, allowed)).toBeUndefined();
  });

  it('rejects the DNS rebinding Host from the report', () => {
    const rejection = validateRequestHeaders('local.firstnamelastname.com', undefined, allowed);
    expect(rejection?.status).toBe(403);
    expect(rejection?.message).toContain('Invalid Host');
  });

  it('rejects a missing Host header', () => {
    expect(validateRequestHeaders(undefined, undefined, allowed)?.message).toBe('Missing Host header');
    expect(validateRequestHeaders('   ', undefined, allowed)?.message).toBe('Missing Host header');
  });

  it('rejects an unparseable Host header', () => {
    expect(validateRequestHeaders('/', undefined, allowed)?.status).toBe(403);
  });

  it('rejects a mismatched Origin even when Host is allowed', () => {
    const rejection = validateRequestHeaders('127.0.0.1:3000', 'http://local.firstnamelastname.com:3000', allowed);
    expect(rejection?.status).toBe(403);
    expect(rejection?.message).toContain('Invalid Origin');
  });

  it('rejects a null / unparseable Origin', () => {
    expect(validateRequestHeaders('127.0.0.1:3000', 'null', allowed)?.message).toContain('Invalid Origin');
  });

  it('accepts a matching Origin regardless of port', () => {
    expect(validateRequestHeaders('127.0.0.1:3000', 'http://127.0.0.1:3000', allowed)).toBeUndefined();
    expect(validateRequestHeaders('localhost:3000', 'http://localhost:3000', allowed)).toBeUndefined();
  });

  it('fails closed on an empty allowlist rather than allowing the request', () => {
    const rejection = validateRequestHeaders(
      'local.firstnamelastname.com',
      'http://local.firstnamelastname.com',
      new Set(),
    );
    expect(rejection?.status).toBe(403);
    expect(rejection?.message).toBe('Host validation is not configured');
    // Even an otherwise-legitimate request is refused, so the misconfiguration cannot go unnoticed.
    expect(validateRequestHeaders('127.0.0.1:3000', undefined, new Set())?.status).toBe(403);
  });

  it('blocks the reported attack on a wildcard bind with no override', () => {
    const wildcard = buildAllowedHostnames('0.0.0.0', undefined);
    expect(validateRequestHeaders('local.attacker.example', undefined, wildcard)?.status).toBe(403);
    expect(validateRequestHeaders('127.0.0.1:3000', 'http://local.attacker.example:3000', wildcard)?.status).toBe(403);
    // Loopback access still works, so running with --host 0.0.0.0 locally is unaffected.
    expect(validateRequestHeaders('localhost:3000', undefined, wildcard)).toBeUndefined();
  });

  it('truncates and flattens attacker-controlled values in the message', () => {
    const rejection = validateRequestHeaders(`evil${'a'.repeat(200)}.com`, undefined, allowed);
    expect(rejection?.message.length).toBeLessThan(140);
    expect(rejection?.message).not.toMatch(/[\r\n]/);
  });
});

describe('hasExplicitAllowlist', () => {
  it('is true only when the override contains a usable hostname', () => {
    expect(hasExplicitAllowlist('mcp.example.com')).toBe(true);
    expect(hasExplicitAllowlist(' a.example.com , b.example.com ')).toBe(true);
  });

  it('is false for absent or unusable overrides', () => {
    expect(hasExplicitAllowlist(undefined)).toBe(false);
    expect(hasExplicitAllowlist('')).toBe(false);
    expect(hasExplicitAllowlist('  ,  ')).toBe(false);
  });
});
