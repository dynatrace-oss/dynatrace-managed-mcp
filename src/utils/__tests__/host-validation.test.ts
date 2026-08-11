import {
  buildAllowedHostnames,
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
    expect(buildAllowedHostnames('127.0.0.1')).toEqual(['127.0.0.1', 'localhost', '[::1]']);
  });

  it('includes a LAN bind address alongside loopback names', () => {
    expect(buildAllowedHostnames('192.168.0.1')).toEqual(['192.168.0.1', 'localhost', '127.0.0.1', '[::1]']);
  });

  it('returns an empty list for a wildcard bind with no override', () => {
    expect(buildAllowedHostnames('0.0.0.0')).toEqual([]);
    expect(buildAllowedHostnames('::')).toEqual([]);
  });

  it('lets an override win, including for wildcard binds', () => {
    expect(buildAllowedHostnames('0.0.0.0', 'mcp.example.com')).toEqual(['mcp.example.com']);
    expect(buildAllowedHostnames('127.0.0.1', 'mcp.example.com')).toEqual(['mcp.example.com']);
  });

  it('parses, normalizes and dedupes override lists', () => {
    expect(buildAllowedHostnames('0.0.0.0', ' A.example.com:3000 , b.example.com , a.example.com ')).toEqual([
      'a.example.com',
      'b.example.com',
    ]);
  });

  it('ignores an override that contains nothing usable', () => {
    expect(buildAllowedHostnames('127.0.0.1', '  ,  ')).toEqual(['127.0.0.1', 'localhost', '[::1]']);
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

  it('treats an empty allowlist as validation disabled', () => {
    expect(
      validateRequestHeaders('local.firstnamelastname.com', 'http://local.firstnamelastname.com', []),
    ).toBeUndefined();
  });

  it('truncates and flattens attacker-controlled values in the message', () => {
    const rejection = validateRequestHeaders(`evil${'a'.repeat(200)}.com`, undefined, allowed);
    expect(rejection?.message.length).toBeLessThan(140);
    expect(rejection?.message).not.toMatch(/[\r\n]/);
  });
});
