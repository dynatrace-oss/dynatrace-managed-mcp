/*
 * Test sets up a basic HTTP proxy, which forwards all requests to a local echo server, adding the
 * extra header 'Myproxyheader'. The echo server reports back the request line and headers it
 * received, so we can assert that the request really travelled through the proxy.
 *
 * Note on the proxy setup: axios (`proxy: { host, port }`) speaks the *forward* proxy protocol - it
 * sends an absolute-form request target (`GET http://example.com/anything/mypath`) and keeps the
 * origin `Host` header. http-proxy is a *reverse* proxy: `createProxyServer({ target })` rewrites
 * the path onto the fixed target but leaves `Host` alone (`changeOrigin` defaults to false). That
 * combination only works against an upstream that tolerates a foreign `Host` header - a local echo
 * server does, whereas a load-balanced public service answers 503 - which is why the upstream here
 * is local rather than a public request-echo site.
 */
import { ManagedAuthClient } from '../../src/authentication/managed-auth-client';
import httpProxy from 'http-proxy';
import { logger } from '../../src/utils/logger';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';

/** Shape of the JSON echoed back by the local upstream below. */
interface EchoResponse {
  headers: Record<string, string | undefined>;
  url: string;
}

describe('ProxyConfig', () => {
  let proxyUrl: string;
  let proxy: httpProxy<IncomingMessage, ServerResponse<IncomingMessage>>;
  let upstream: Server;
  let upstreamUrl: string;
  let originalEnvs: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnvs = { ...process.env };
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;

    upstream = createServer((req, res) => {
      const echo: EchoResponse = {
        headers: req.headers as Record<string, string | undefined>,
        url: `http://${req.headers.host}${req.url}`,
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(echo));
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;

    proxy = httpProxy.createProxyServer({
      target: upstreamUrl,
      xfwd: true,
      headers: { Myproxyheader: 'myproxyval' },
    });
    proxy.on('error', (err) => {
      logger.error('proxy.error: ', { data: err });
    });
    proxy.on('proxyRes', (proxyRes) => {
      logger.info(`proxy.proxyRes: status=${proxyRes.statusCode}`);
    });
    proxy.listen(8123);
    proxyUrl = `http://localhost:8123`;
  });

  afterEach(async () => {
    if (originalEnvs) process.env = originalEnvs;
    if (proxy) proxy.close();
    if (upstream) await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  it('should use HTTP_PROXY', async () => {
    const client = new ManagedAuthClient({
      apiBaseUrl: 'http://example.com',
      dashboardBaseUrl: 'http://example-dashboard.com',
      alias: 'alias',
      httpsProxy: proxyUrl,
      minimum_version: '1.328.0',
    });

    const response = await client.makeRequest<EchoResponse>('/anything/mypath', 'my-example-token');

    // Header names arrive lowercased from node's HTTP parser.
    expect(response.headers.myproxyheader).toEqual('myproxyval');
    // Proves axios sent the absolute-form target through the proxy with the original Host intact.
    expect(response.url).toEqual('http://example.com/anything/mypath');
    client.cleanup();
  });
});
