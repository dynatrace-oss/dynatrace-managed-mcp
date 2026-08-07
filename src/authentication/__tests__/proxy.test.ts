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

    it(
      'should warn (without throwing) and use httpsProxyUrl when both httpProxyUrl and httpsProxyUrl are set, ' +
        'disclosing the NO_PROXY/routing behaviour change',
      () => {
        const httpProxy = 'http://myuser:mypass@myhost.com:1234';
        const httpsProxy = 'https://myuser:mypass@myhost.com:4321';
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        const response = setAxiosProxy(httpProxy, httpsProxy, 'my-alias');

        // Deterministically prefers httpsProxyUrl and keeps running - does not throw, does not
        // disable the proxy.
        expect(response).toEqual({
          host: 'myhost.com',
          port: 4321,
          protocol: 'https:',
          auth: { username: 'myuser', password: 'mypass' },
        });

        // The warning must actually reach the terminal (console.warn writes to stderr directly,
        // independent of the Winston transports LOG_OUTPUT controls), must name the config fields
        // and the alias, and - because an explicit proxy config changes real routing behaviour
        // (axios's setProxy() only falls back to the HTTP_PROXY/HTTPS_PROXY env vars, with NO_PROXY
        // honoured, when no explicit `proxy` is configured) - must say so, not just "configure only
        // one".
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        const warningMessage = consoleWarnSpy.mock.calls[0][0] as string;
        expect(warningMessage).toContain('[Alias: my-alias]');
        expect(warningMessage).toContain('httpsProxyUrl');
        expect(warningMessage).toContain('httpProxyUrl');
        expect(warningMessage).toContain('configure only one');
        expect(warningMessage).toContain('HTTP_PROXY');
        expect(warningMessage).toContain('HTTPS_PROXY');
        expect(warningMessage).toContain('NO_PROXY');

        consoleWarnSpy.mockRestore();
      },
    );

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
