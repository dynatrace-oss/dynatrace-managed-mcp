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

    it('should return undefined if set HTTP_PROXY and HTTPS_PROXY', () => {
      process.env.HTTP_PROXY = 'http://myuser:mypass@myhost.com:1234';
      process.env.HTTPS_PROXY = 'https://myuser:mypass@myhost.com:4321';

      const response = setAxiosProxy();
      expect(response).toBeUndefined();
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
          fail('Error is not instace of Error type');
        }
      }
    });
  });
});
