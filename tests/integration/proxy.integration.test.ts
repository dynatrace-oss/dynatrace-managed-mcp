/*
 * Test sets up a basic HTTP proxy, which forwards all requests to httpbin.org, adding the extra header 'Myproxyheader'
 * The response we get back from httpbin.org/anything/mypath will tell us what headers it received.
 * We can therefore assert that it was correctly passed to the proxy.
 */
import { ManagedAuthClient } from '../../src/authentication/managed-auth-client';
import httpProxy from 'http-proxy';
import { logger } from '../../src/utils/logger';

describe('ProxyConfig', () => {
  let proxyUrl: string;
  let proxy: any;
  let originalEnvs: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnvs = { ...process.env };
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;

    proxy = httpProxy.createProxyServer({
      target: 'http://httpbin.org',
      xfwd: true,
      headers: { Myproxyheader: 'myproxyval' },
    });
    proxy.on('open', (proxySocket: any) => {
      console.log(`proxy.open: proxySocket=${JSON.stringify(proxySocket)}`);
    });
    proxy.on('close', (res: any, socket: any, head: any) => {
      console.log(`proxy.close res=${JSON.stringify(res)}`);
    });
    proxy.on('error', (err: any) => {
      logger.error('proxy.error: ', { data: err });
      console.log(err);
    });
    proxy.on('proxyRes', (proxyRes: any, req: any, res: any) => {
      console.log(`proxy.proxyRes: req=${req}; proxyRes=${proxyRes}; res=${res}`);
    });
    proxy.listen(8123);
    proxyUrl = `http://localhost:8123`;
  });

  afterEach(() => {
    if (originalEnvs) process.env = originalEnvs;
    if (proxy) proxy.close();
  });

  it(
    'should use HTTP_PROXY',
    async () => {
      process.env.HTTP_PROXY = proxyUrl;

      let client = new ManagedAuthClient('http://example.com', 'test-token');
      const response = await client.makeRequest('/anything/mypath');

      console.log(`response: ${JSON.stringify(response)}`);
      expect(response.headers.Myproxyheader).toEqual('myproxyval');
      expect(response.url).toEqual('http://example.com/anything/mypath');
    },
    60 * 1000,
  );
});
