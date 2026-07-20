#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { Command } from 'commander';
import { ZodRawShape } from 'zod';
import { getPackageJsonVersion } from './utils/version';
import {
  ManagedAuthClientManager,
  ManagedAuthClient,
  buildManagedAuthClients,
  validateManagedClients,
} from './authentication/managed-auth-client';
import { getManagedEnvironmentConfigs, validateEnvironments, buildConfigTokenMap } from './utils/environment';
import { parseTokenHeader, deriveUserKey } from './utils/token-header';
import { createTelemetry } from './utils/telemetry-openkit';
import { MetricsApiClient } from './capabilities/metrics-api';
import { LogsApiClient } from './capabilities/logs-api';

import { EventsApiClient } from './capabilities/events-api';
import { EntitiesApiClient } from './capabilities/entities-api';
import { ProblemsApiClient } from './capabilities/problems-api';
import { SecurityApiClient } from './capabilities/security-api';
import { SloApiClient } from './capabilities/slo-api';

import { RateLimiter } from './utils/rate-limit';
import { buildServerInstructions } from './server-instructions';
import { patchToolsListSchema } from './utils/mcp-compat';
import { registerAllTools, ToolContext } from './tools';

// Import logger after environment is loaded
import { logger, flushLogger, logErrorObject } from './utils/logger';

logger.info('Starting Dynatrace Managed MCP');

// Per-user (per-token) rate limiter, shared across requests for the life of the process.
// In stdio mode there is a single user key, which reproduces the previous single-bucket behavior.
const rateLimiter = new RateLimiter();

const main = async () => {
  logger.info(`Initializing Dynatrace Managed MCP Server v${getPackageJsonVersion()}...`);

  // Parse CLI options first so the server mode is known before configuration is loaded.
  const program = new Command();
  program
    .name('dynatrace-managed-mcp')
    .description('Dynatrace Managed Model Context Protocol (MCP) Server')
    .version(getPackageJsonVersion())
    .option('--http', 'enable HTTP server mode instead of stdio')
    .option('--server', 'enable HTTP server mode (alias for --http)')
    .option('-p, --port <number>', 'port for HTTP server', '3000')
    .option('-H, --host <host>', 'host for HTTP server', '127.0.0.1')
    .parse();

  const options = program.opts();
  const httpMode = options.http || options.server;
  const httpPort = parseInt(options.port, 10);
  const host = options.host || '127.0.0.1';

  // Read Managed environment configuration. In HTTP mode tokens are supplied per request
  // (X-Dynatrace-Tokens header), so apiToken is not required in the config.
  const managedConfigs = getManagedEnvironmentConfigs(!httpMode);
  const validatedConfigs = validateEnvironments(managedConfigs, !httpMode);

  const initErrors = validatedConfigs['errors'];
  const initConfigs = validatedConfigs['valid_configs'];

  if (initErrors.length > 0) {
    logger.error('Failed to get managed environments configurations: ', { error: initErrors });
    console.error('Failed to get managed environments configurations: ', { error: initErrors });
  }

  if (initConfigs.length === 0) {
    logger.error('No valid environments found, stopping.');
    console.error('No valid environments found, stopping.');
    await flushLogger();
    process.exit(1);
  }

  // Build shared, token-less auth clients (axios instances are created once and reused).
  const allClients = buildManagedAuthClients(initConfigs);

  // Resolve queryable environments + token source per mode.
  let validClients: ManagedAuthClient[];
  let validAliases: string[];
  let startupTokens: Map<string, string>;
  if (httpMode) {
    // No server-side tokens; tokens arrive per request. No startup connectivity test.
    validClients = allClients;
    validAliases = ['ALL_ENVIRONMENTS', ...allClients.map((c) => c.alias)];
    startupTokens = new Map();
  } else {
    // stdio: tokens come from the local config/env vars; validate connections at startup.
    startupTokens = buildConfigTokenMap(initConfigs);
    const validation = await validateManagedClients(allClients, startupTokens);
    validClients = validation.validClients;
    validAliases = validation.validAliases;
  }

  // Initialize usage tracking
  const telemetry = createTelemetry();
  await telemetry.trackMcpServerStart();

  // Create a shutdown handler that takes shutdown operations as parameters
  const shutdownHandler = (...shutdownOps: Array<() => void | Promise<void>>) => {
    return async () => {
      logger.info('Shutting down MCP server...');
      for (const op of shutdownOps) {
        await op();
      }
      await flushLogger();
      process.exit(0);
    };
  };

  // Factory: creates a new McpServer with all tools registered, bound to this caller's tokens.
  // Must be called per-request in stateless HTTP mode (the SDK forbids connecting
  // the same McpServer instance to more than one transport).
  const createConfiguredMcpServer = (tokenMap: Map<string, string>, userKey: string) => {
    // Per-request auth router + API clients.
    const authClientManager = new ManagedAuthClientManager(allClients, validClients, validAliases, tokenMap);
    const metricsClient = new MetricsApiClient(authClientManager);
    const logsClient = new LogsApiClient(authClientManager);
    const eventsClient = new EventsApiClient(authClientManager);
    const entitiesClient = new EntitiesApiClient(authClientManager);
    const problemsClient = new ProblemsApiClient(authClientManager);
    const securityClient = new SecurityApiClient(authClientManager);
    const sloClient = new SloApiClient(authClientManager);

    const server = new McpServer(
      {
        name: 'Dynatrace Managed MCP Server',
        version: getPackageJsonVersion(),
      },
      {
        capabilities: {
          tools: {},
        },
        instructions: buildServerInstructions(authClientManager.MINIMUM_VERSION),
      },
    );

    // Ready to start the server
    logger.info(`Starting Dynatrace Managed MCP Server v${getPackageJsonVersion()}...`);

    // Tool wrapper for consistent error handling and telemetry
    const tool = <TArgs = undefined>(
      name: string,
      description: string,
      paramsSchema: ZodRawShape,
      annotations: ToolAnnotations,
      cb: (args: TArgs) => Promise<string>,
    ) => {
      const wrappedCb = async (args: TArgs): Promise<CallToolResult> => {
        // Capture starttime for telemetry and rate limiting
        const startTime = Date.now();

        // Per-user (per-token) rate limiting. userKey identifies the caller for this request.
        if (!rateLimiter.tryAcquire(userKey)) {
          logger.debug(`Rate-limiting tool execution: ${name}; args: ${JSON.stringify(args)}`);
          return {
            content: [
              {
                type: 'text',
                text: `Rate limit exceeded: Maximum ${rateLimiter.maxCalls} tool calls per ${rateLimiter.windowMs / 1000} seconds. Please try again later.`,
              },
            ],
            isError: true,
          };
        }

        let toolCallSuccessful = false;

        try {
          logger.debug(`Executing tool: ${name}; args: ${JSON.stringify(args)}`);
          const response = await cb(args);
          toolCallSuccessful = true;
          logger.debug(
            `Executed tool: ${name}; args: ${JSON.stringify(args)}; response length ${response.length} chars; ${response}`,
          );
          return {
            content: [{ type: 'text', text: response }],
          };
        } catch (error) {
          logErrorObject(error, `Failed to run tool ${name}`);
          if (error instanceof Error) {
            telemetry.trackError(error, `tool_${name}`).catch((e) => logErrorObject(e, 'Failed to track error'));
            return {
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            };
          }
          return {
            content: [{ type: 'text', text: 'Error: Unknown error' }],
            isError: true,
          };
        } finally {
          const duration = Date.now() - startTime;
          telemetry
            .trackMcpToolUsage(name, toolCallSuccessful, duration)
            .catch((e) => logger.warn(`Failed to track tool usage: ${e.message}`, { error: e }));
        }
      };

      server.registerTool(
        name,
        {
          description,
          inputSchema: paramsSchema,
          annotations,
        },
        wrappedCb as ToolCallback<ZodRawShape>,
      );
    };

    const envAliasValidate = (alias: string) => {
      if (alias == 'ALL_ENVIRONMENTS') {
        return true;
      }
      const env_list = alias.split(';');
      for (const env_alias of env_list) {
        if (!authClientManager.validAliases.includes(env_alias)) {
          return false;
        }
      }
      return true;
    };

    // Assemble the per-request context and register all tools (grouped by capability in src/tools/*).
    const toolContext: ToolContext = {
      tool,
      authClientManager,
      metricsClient,
      logsClient,
      eventsClient,
      entitiesClient,
      problemsClient,
      securityClient,
      sloClient,
      envAliasValidate,
      initErrors,
      httpMode,
    };
    registerAllTools(toolContext);

    // Strip schema properties that break some MCP clients (e.g. Copilot CLI). See helper for details.
    patchToolsListSchema(server);

    return server;
  }; // end createConfiguredMcpServer

  // CLI options were parsed at the start of main(); httpMode, httpPort, and host are already set.

  // HTTP server mode (Stateless)
  if (httpMode) {
    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      // Reject requests without the X-Dynatrace-Tokens header before creating any MCP server
      // instance, to prevent unauthenticated callers from receiving server info or the tool list
      // via the MCP initialize handshake.
      const tokenHeader = req.headers['x-dynatrace-tokens'];
      if (!tokenHeader) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32000, message: 'Unauthorized: X-Dynatrace-Tokens header is required' },
          }),
        );
        return;
      }

      // Parse request body for POST requests
      let body: unknown;
      // Create a new Stateless HTTP Transport
      // enableJsonResponse: true returns application/json instead of keeping SSE streams open,
      // which is required for MCP clients that don't support persistent SSE connections (e.g. Copilot CLI).
      const httpTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // No Session ID needed
        enableJsonResponse: true,
      });

      // Per-request tokens come from the X-Dynatrace-Tokens header (alias=token;alias=token).
      const tokenMap = parseTokenHeader(tokenHeader);
      const userKey = deriveUserKey(Array.isArray(tokenHeader) ? tokenHeader.join(';') : tokenHeader);

      // Create a fresh McpServer per request (stateless HTTP requirement)
      const server = createConfiguredMcpServer(tokenMap, userKey);

      res.on('close', () => {
        // close transport and server, but not the httpServer itself
        httpTransport.close();
        server.close();
      });

      // Connecting MCP-server to HTTP transport
      await server.connect(httpTransport);

      // Handle POST Requests for this endpoint
      if (req.method === 'POST') {
        const maxBodySize = parseInt(process.env.DT_MCP_MAX_BODY_SIZE ?? String(1 * 1024 * 1024), 10); // default 1MB
        const chunks: Buffer[] = [];
        let totalSize = 0;
        let tooLarge = false;
        for await (const chunk of req) {
          totalSize += chunk.length;
          if (totalSize > maxBodySize) {
            tooLarge = true;
            break;
          }
          chunks.push(chunk);
        }
        if (tooLarge) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Request Entity Too Large' } }),
          );
          return;
        }
        const rawBody = Buffer.concat(chunks).toString();
        try {
          body = JSON.parse(rawBody);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          // Respond with a JSON-RPC Parse error
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
          return;
        }
      }

      await httpTransport.handleRequest(req, res, body);
    });

    // Start HTTP Server on the specified host and port
    httpServer.listen(httpPort, host, () => {
      logger.info(`Dynatrace Managed MCP Server running on HTTP at http://${host}:${httpPort}`);
      console.error(`Dynatrace Managed MCP Server running on HTTP at http://${host}:${httpPort}`);
    });

    // Handle graceful shutdown for http server mode
    process.on(
      'SIGINT',
      shutdownHandler(
        async () => await telemetry.shutdown(),
        () =>
          new Promise<void>((resolve) => {
            httpServer.closeAllConnections?.(); // Force close all connections (Node.js 18.2+)
            httpServer.close(() => resolve());
          }),
      ),
    );
    process.on(
      'SIGTERM',
      shutdownHandler(
        async () => await telemetry.shutdown(),
        () =>
          new Promise<void>((resolve) => {
            httpServer.closeAllConnections?.(); // Force close all connections (Node.js 18.2+)
            httpServer.close(() => resolve());
          }),
      ),
    );
  } else {
    // Default stdio mode
    const server = createConfiguredMcpServer(startupTokens, 'local');
    const transport = new StdioServerTransport();

    // Warn if LOG_OUTPUT is set to stdout/console (won't work with stdio)
    const logOutput = (process.env.LOG_OUTPUT || '').toLowerCase();
    if (
      logOutput === 'console' ||
      logOutput === 'stdout' ||
      logOutput === 'file+console' ||
      logOutput === 'file+stdout'
    ) {
      console.error(
        `WARNING: LOG_OUTPUT=${process.env.LOG_OUTPUT} won't show logs in stdio transport. ` +
          `Stdout is reserved for MCP protocol. Use LOG_OUTPUT=stderr-all or LOG_OUTPUT=file instead.`,
      );
    }

    logger.info('Connecting server to transport...');
    await server.connect(transport);

    logger.info('Dynatrace Managed MCP Server running on stdio');
    console.error('Dynatrace Managed MCP Server running on stdio');

    // Handle graceful shutdown for stdio mode
    process.on(
      'SIGINT',
      shutdownHandler(async () => await telemetry.shutdown()),
    );
    process.on(
      'SIGTERM',
      shutdownHandler(async () => await telemetry.shutdown()),
    );
  }
};

main().catch(async (error) => {
  logErrorObject(error, 'Fatal error in main()');
  try {
    // report error in main
    const telemetry = createTelemetry();
    await telemetry.trackError(error, 'main_error');
    await telemetry.shutdown();
  } catch (e) {
    logErrorObject(e, 'Failed to track');
  }
  await flushLogger();
  process.exit(1);
});
