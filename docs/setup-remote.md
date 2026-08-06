# Remote setup (HTTP)

Remote (HTTP) mode is for one server shared by a team: it runs once, keeps listening, and each person's AI client connects to it over the network instead of launching their own copy. The server holds no Dynatrace API tokens of its own — every caller supplies their own per request — so many people with different levels of access can share the same deployment safely.

Reach for this mode when you want always-on, shared hosting, load balancing across replicas, or a backend for web clients, not just a single person's editor. The server itself is stateless — it builds a fresh instance per request instead of keeping session state — which is exactly what makes it safe to run behind a load balancer with multiple replicas. For a single person running the server on their own machine, see [Set up local (stdio) mode](setup-local.md) instead.

Each caller needs their own Dynatrace Managed API token with the required scopes before any of this works — see [Create an API token](api-token.md#required-scopes).

## How authentication works

There is no server-side token at all. Every request carries the caller's own per-environment tokens in one header:

```text
X-Dynatrace-Tokens: production=dt0c01.AAA;staging=dt0c01.BBB
```

The server uses the caller's token for the environment named by `environment_alias`, so each user sees only the data their own token permits — two people talking to the same server can have completely different access. A request that targets an environment the caller didn't supply a token for is rejected, naming the missing alias.

The alias on the left of each `=` must match an `alias` in the server's own configuration **exactly**. A mismatched alias is rejected with the same `401 Unauthorized` response as a missing or invalid token, even when the token itself is perfectly valid — the server never gets far enough to check the token, because it never finds a configured environment to check it against. If a request is unexpectedly unauthorized, check your aliases before assuming your token is bad.

Three things the previous documentation never made clear:

- **There is no live-cluster check in HTTP mode.** Structural config validation still runs — a malformed config (a missing required field, or zero valid entries) still makes the server log the problem and exit `1`, exactly as in local mode. What HTTP mode skips is _contacting your cluster_ at startup, because tokens don't exist server-side yet to test with. A wrong `apiEndpointUrl` or a revoked token therefore isn't caught at launch — it surfaces on the first request against that environment, as `401 Unauthorized: no valid Dynatrace token supplied`. See [Smoke-test it](#smoke-test-it) below: it's the only way to confirm a remote deployment actually works.
- **Token validity is cached for 60 seconds by default.** A revoked token can still be accepted for up to that long after revocation. Tune it with `DT_MCP_TOKEN_VALIDATION_TTL_MS` — see [Environment variables](configuration.md#environment-variables).
- **Rate limiting buckets per caller**, keyed by the token header, not per server — see [Rate limiting](configuration.md#rate-limiting).

## Write the environment configuration

> [!IMPORTANT]
> In HTTP mode, `apiToken` is ignored — the server never reads it here, because tokens arrive per request instead (see [How authentication works](#how-authentication-works) above). Nothing rejects a config that still includes it, but omit it anyway: with only non-secret connection details left, the file has no unused secret sitting at rest, and it's safe to commit.

Create a config file with one entry per environment, no tokens. The alias is yours to choose — it's used below as `production`/`staging` to match the rest of this page's examples and the README's quickstart:

```yaml
# HTTP mode configuration: NO tokens here.
# Each user supplies their own per-environment tokens at request time via the
# X-Dynatrace-Tokens header (alias=token;alias=token). Only non-secret connection
# details live in this file, so it is safe to commit to version control.
- alias: production
  apiEndpointUrl: https://prod-api.company.com/
  environmentId: abc-123
  dynatraceUrl: https://prod-dashboard.company.com/

- alias: staging
  apiEndpointUrl: https://staging-api.company.com/
  environmentId: xyz-789
  dynatraceUrl: https://staging-dashboard.company.com/
```

A further example, using different alias names (`prod`/`staging`) to underline that the choice is yours: [`examples/dt-config-http.yaml`](../examples/dt-config-http.yaml). Whichever aliases you pick, the `X-Dynatrace-Tokens` header you send must use the same ones — see [How authentication works](#how-authentication-works) above. Point the server at your file with `DT_CONFIG_FILE`, or supply the same entries as `DT_ENVIRONMENT_CONFIGS` — see [Configuration file](configuration.md#configuration-file) for path resolution and `${VAR}` interpolation, and [Configuration fields](configuration.md#configuration-fields) for the full field reference.

## Run the server

All of these start the same server in HTTP mode; pick the one that fits your infrastructure.

**Docker (recommended).** A published, multi-arch (`linux/amd64`, `linux/arm64`), cosign-signed image is available at `ghcr.io/dynatrace-oss/dynatrace-managed-mcp`:

```bash
docker run --rm -p 3000:3000 \
  -v ~/.dynatrace/managed-mcp-http.yaml:/config/dt-config.yaml:ro \
  -e DT_CONFIG_FILE=/config/dt-config.yaml \
  ghcr.io/dynatrace-oss/dynatrace-managed-mcp:latest \
  node dist/index.js --http --host 0.0.0.0 --port 3000
```

> [!WARNING]
> `--host` defaults to `127.0.0.1`. A container started **without** `--host 0.0.0.0` binds only to its own loopback interface and accepts no connections from outside itself — including from the Docker host. This is the most common first-attempt failure with this mode; if a freshly started container is unreachable, check this before anything else.

**Docker Compose.** The same image, volume mount and command, with the port published in `ports:`:

```yaml
services:
  dynatrace-managed-mcp:
    image: ghcr.io/dynatrace-oss/dynatrace-managed-mcp:latest
    command: ['node', 'dist/index.js', '--http', '--host', '0.0.0.0', '--port', '3000']
    ports:
      - '3000:3000'
    volumes:
      - ~/.dynatrace/managed-mcp-http.yaml:/config/dt-config.yaml:ro
    environment:
      DT_CONFIG_FILE: /config/dt-config.yaml
```

**Kubernetes.** A starting point to adapt to your cluster's own conventions (namespace, labels, resource limits, TLS setup) — it is not a verified deployment, and no cluster was available to test it against:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dt-managed-mcp-config
data:
  dt-config.yaml: |
    - alias: production
      apiEndpointUrl: https://prod-api.company.com/
      environmentId: abc-123
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dt-managed-mcp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: dt-managed-mcp
  template:
    metadata:
      labels:
        app: dt-managed-mcp
    spec:
      containers:
        - name: dt-managed-mcp
          image: ghcr.io/dynatrace-oss/dynatrace-managed-mcp:latest
          command: ['node', 'dist/index.js', '--http', '--host', '0.0.0.0', '--port', '3000']
          ports:
            - containerPort: 3000
          env:
            - name: DT_CONFIG_FILE
              value: /config/dt-config.yaml
          volumeMounts:
            - name: config
              mountPath: /config
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: dt-managed-mcp-config
---
apiVersion: v1
kind: Service
metadata:
  name: dt-managed-mcp
spec:
  selector:
    app: dt-managed-mcp
  ports:
    - port: 3000
      targetPort: 3000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dt-managed-mcp
spec:
  tls:
    - hosts: ['mcp.internal.company.com']
      secretName: dt-managed-mcp-tls
  rules:
    - host: mcp.internal.company.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: dt-managed-mcp
                port:
                  number: 3000
```

Because the config file carries no secrets, it's mounted from a `ConfigMap` — no `Secret` is needed for it.

**Without a container.** For a bare Node.js process — from a global install, `npx`, or a clone:

```bash
npx -y @dynatrace-oss/dynatrace-managed-mcp-server@latest --http --host 0.0.0.0 --port 3000
```

The flags, all defined on the same command:

| Flag                  | Default     | Notes                                          |
| --------------------- | ----------- | ---------------------------------------------- |
| `--http`              | off (stdio) | Enable HTTP server mode.                       |
| `--server`            | off (stdio) | Alias for `--http`.                            |
| `-p, --port <number>` | `3000`      | Port for the HTTP server.                      |
| `-H, --host <host>`   | `127.0.0.1` | Host/interface to bind. See the warning above. |
| `--version`           | —           | Print the installed version.                   |
| `--help`              | —           | Print usage and exit.                          |

Every `npx` example on this page uses `@dynatrace-oss/dynatrace-managed-mcp-server`. Watch for the package name without "managed" in it — that one is the separate Dynatrace SaaS server and will not work against a Managed cluster.

## Put TLS in front

> [!WARNING]
> Tokens travel in a plain request header, and the server does not terminate TLS itself. Never expose it directly to untrusted networks — put a TLS-terminating reverse proxy in front of it and only expose the proxy.

An nginx example — a starting point to adapt, not a verified configuration:

```nginx
server {
    listen 443 ssl;
    server_name mcp.internal.company.com;

    ssl_certificate     /etc/nginx/certs/mcp.crt;
    ssl_certificate_key /etc/nginx/certs/mcp.key;

    # See "Limits and tuning" below — the token header can be large.
    large_client_header_buffers 4 32k;

    location / {
        proxy_pass http://127.0.0.1:3000;
    }
}
```

## Smoke-test it

Because HTTP mode never contacts your cluster at startup, a server that starts cleanly and listens on its port proves nothing about whether the configuration is actually correct — an all-wrong config with fake URLs starts up exactly as cleanly as a working one. The only real check is a request that gets a successful response:

```bash
curl -s -X POST http://127.0.0.1:3000/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'X-Dynatrace-Tokens: production=dt0c01.YOUR_TOKEN' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Both headers are required — `Accept` must list both `application/json` and `text/event-stream`, or the transport rejects the request. A working deployment returns a JSON-RPC result listing the server's tools. If you don't get that, the deployment is not working yet, regardless of what the server's own logs say.

Two diagnostic cases worth knowing:

- **Omit `X-Dynatrace-Tokens` entirely** (or supply only invalid tokens) and the response is `401` with `Unauthorized: no valid Dynatrace token supplied` — this is the same response a real client gets if its token expired or was never configured.
- **Keep the same, valid token header, but corrupt only the body** (truncate the JSON, for example) and the response is a JSON-RPC parse error, code `-32700`. The token is checked before the body is even read, so an invalid or missing token still short-circuits to `401` first — testing this case with a bad token would only show you the `401` above again.

If neither of those matches what you see, see [Troubleshooting](troubleshooting.md).

## Connect your client

| Client             | Guide                                              |
| ------------------ | -------------------------------------------------- |
| Claude Code        | [Set up Claude Code](clients/claude-code.md)       |
| VS Code + Copilot  | [Set up VS Code](clients/vs-code-copilot.md)       |
| GitHub Copilot CLI | [Set up Copilot CLI](clients/copilot-cli.md)       |
| Claude Desktop     | [Set up Claude Desktop](clients/claude-desktop.md) |

Cursor, Windsurf, Kiro, Gemini CLI and ChatGPT: [other clients](clients/other-clients.md). Each client page has a section for connecting to a remote (HTTP) server specifically.

The generic shape any HTTP-capable MCP client needs — a URL and the token header — is in [`examples/mcp-config-http.json`](../examples/mcp-config-http.json).

## Limits and tuning

**Header size, from the number of environments a caller has tokens for.** Each `X-Dynatrace-Tokens` entry is roughly `alias=dt0c01.<token>;` — about 110 characters. Node's default HTTP header size limit is 16 KB, which fits roughly 140–150 environments in one header before requests are rejected. Raise it at server startup:

```bash
node --max-http-header-size=65536 ./dist/index.js --http
```

If you run a reverse proxy in front (see [Put TLS in front](#put-tls-in-front) above), it enforces its own, usually smaller, limit — nginx defaults to 8 KB, fitting roughly 70 environments, raised the same way shown there:

```nginx
large_client_header_buffers 4 32k;
```

**Request body size.** `DT_MCP_MAX_BODY_SIZE` caps the accepted POST body, HTTP mode only — default 1 MB (`1048576` bytes). A larger request is rejected with `413 Request Entity Too Large` before it's parsed. See [Environment variables](configuration.md#environment-variables) for the full list.
