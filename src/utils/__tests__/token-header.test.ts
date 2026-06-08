import { parseTokenHeader, deriveUserKey } from '../token-header';

// Silence + observe logger output
jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('parseTokenHeader', () => {
  it('parses an alias=token;alias=token map', () => {
    const map = parseTokenHeader('prod=dt0c01.AAA;staging=dt0c01.BBB');
    expect(map.get('prod')).toBe('dt0c01.AAA');
    expect(map.get('staging')).toBe('dt0c01.BBB');
    expect(map.size).toBe(2);
  });

  it('trims surrounding whitespace around aliases and tokens', () => {
    const map = parseTokenHeader('  prod = dt0c01.AAA ;  staging=dt0c01.BBB  ');
    expect(map.get('prod')).toBe('dt0c01.AAA');
    expect(map.get('staging')).toBe('dt0c01.BBB');
  });

  it('returns an empty map for undefined or empty input', () => {
    expect(parseTokenHeader(undefined).size).toBe(0);
    expect(parseTokenHeader('').size).toBe(0);
    expect(parseTokenHeader('   ').size).toBe(0);
  });

  it('skips malformed pairs that have no "="', () => {
    const map = parseTokenHeader('prod=dt0c01.AAA;garbage;=novalue;noalias=');
    expect(map.get('prod')).toBe('dt0c01.AAA');
    expect(map.has('noalias')).toBe(false); // alias present but empty token -> skipped
    expect(map.size).toBe(1);
  });

  it('keeps only the first "=" so token values may contain "="', () => {
    const map = parseTokenHeader('prod=dt0c01.A=B=C');
    expect(map.get('prod')).toBe('dt0c01.A=B=C');
  });

  it('uses the last value when an alias is repeated', () => {
    const map = parseTokenHeader('prod=first;prod=second');
    expect(map.get('prod')).toBe('second');
  });

  it('joins an array-valued header before parsing', () => {
    const map = parseTokenHeader(['prod=dt0c01.AAA', 'staging=dt0c01.BBB']);
    expect(map.get('prod')).toBe('dt0c01.AAA');
    expect(map.get('staging')).toBe('dt0c01.BBB');
  });
});

describe('deriveUserKey', () => {
  it('returns "anonymous" when no token header is present', () => {
    expect(deriveUserKey(undefined)).toBe('anonymous');
    expect(deriveUserKey('')).toBe('anonymous');
    expect(deriveUserKey('   ')).toBe('anonymous');
  });

  it('is stable for the same input and is a 64-char hex digest', () => {
    const a = deriveUserKey('prod=dt0c01.AAA;staging=dt0c01.BBB');
    const b = deriveUserKey('prod=dt0c01.AAA;staging=dt0c01.BBB');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs for different token bundles', () => {
    expect(deriveUserKey('prod=AAA')).not.toBe(deriveUserKey('prod=BBB'));
  });
});
