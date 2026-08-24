import { ManagedAuthClient } from '../../src/authentication/managed-auth-client';
import { createServer, Server } from 'node:http';

/** Shape of the JSON echoed back by the local server below. */
interface AuthEchoResponse {
  ok: boolean;
  auth: string | null;
}

/**
 * Spins up a local HTTP server that echoes back the Authorization header it received.
 * No Dynatrace credentials or network access required.
 */
describe('Token passthrough (per-call Authorization)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll((done) => {
    server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, auth: req.headers['authorization'] ?? null }));
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => done());
  });

  function newClient(): ManagedAuthClient {
    return new ManagedAuthClient({
      apiBaseUrl: baseUrl,
      dashboardBaseUrl: baseUrl,
      alias: 'local',
      minimum_version: '1.328.0',
    });
  }

  it('sends Api-Token Authorization for the supplied token', async () => {
    const client = newClient();
    const data = await client.makeRequest<AuthEchoResponse>('/api/v2/metrics', 'tok-123', { pageSize: 1 });
    expect(data.auth).toBe('Api-Token tok-123');
    client.cleanup();
  });

  it('uses the correct token per concurrent call (no cross-contamination)', async () => {
    const client = newClient();
    const [a, b] = await Promise.all([
      client.makeRequest<AuthEchoResponse>('/x', 'tokenA'),
      client.makeRequest<AuthEchoResponse>('/y', 'tokenB'),
    ]);
    expect(a.auth).toBe('Api-Token tokenA');
    expect(b.auth).toBe('Api-Token tokenB');
    client.cleanup();
  });
});
