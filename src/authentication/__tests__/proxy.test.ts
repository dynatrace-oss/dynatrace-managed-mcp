import { setAxiosProxy } from '../managed-auth-client';

// Mock undici
describe('proxy-config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };

    // Clear all proxy-related env vars
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
  });

  afterEach(() => {
    if (originalEnv) process.env = originalEnv;
  });

  describe('configureProxyFromEnvironment', () => {
    it('should parse HTTP_PROXY', () => {
      process.env.HTTP_PROXY = 'http://myhost.com:1234';
      const response = setAxiosProxy(process.env.HTTP_PROXY);

      expect(response).toEqual({
        host: 'myhost.com',
        port: 1234,
        protocol: 'http:',
        auth: undefined,
      });
    });

    it('should parse HTTPS_PROXY', () => {
      process.env.HTTPS_PROXY = 'https://myhost.com:1234';
      const response = setAxiosProxy(process.env.HTTPS_PROXY);

      expect(response).toEqual({
        host: 'myhost.com',
        port: 1234,
        protocol: 'https:',
        auth: undefined,
      });
    });

    it('should parse auth', () => {
      process.env.HTTP_PROXY = 'http://myuser:mypass@myhost.com:1234';
      const response = setAxiosProxy(process.env.HTTP_PROXY);

      expect(response).toEqual({
        host: 'myhost.com',
        port: 1234,
        protocol: 'http:',
        auth: { username: 'myuser', password: 'mypass' },
      });
    });

    it('should return undefined if no proxy', () => {
      const response = setAxiosProxy();
      expect(response).toBeUndefined();
    });

    it('should throw if both httpProxyUrl and httpsProxyUrl are set, naming the config fields (not env vars)', () => {
      const httpProxy = 'http://myuser:mypass@myhost.com:1234';
      const httpsProxy = 'https://myuser:mypass@myhost.com:4321';

      expect(() => setAxiosProxy(httpProxy, httpsProxy)).toThrow(
        'Cannot specify both httpsProxyUrl and httpProxyUrl for the same environment; configure only one.',
      );
    });

    it('should fail if invalid URL', () => {
      process.env.HTTP_PROXY = 'this is not a url';
      try {
        const response = setAxiosProxy(process.env.HTTP_PROXY);
        fail(`Should have failed, but returned response=${response}`);
      } catch (err) {
        if (err instanceof Error) {
          expect(err.message).toContain('Failed to parse and configure http(s) proxy');
        } else {
          fail('Error is not instance of Error type');
        }
      }
    });
  });
});
