import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from './logger';

type ToolsListHandler = (req: unknown) => Promise<{ tools: Array<Record<string, unknown>> }>;

/**
 * Wrap the tools/list request handler to strip properties that cause some MCP clients
 * (e.g. Copilot CLI) to receive a 400 Bad Request from their AI model API:
 *   - $schema: added by zod-to-json-schema; rejected by GitHub Copilot model API
 *   - additionalProperties: false: triggers OpenAI strict-mode validation which requires
 *     ALL properties to be listed in `required`; our tools have optional params so this
 *     combination is rejected. Removing it allows optional params without strict-mode errors.
 * Both properties are optional per JSON Schema spec; removing them does not affect
 * schema validity or tool behaviour for any other client.
 */
export function patchToolsListSchema(server: McpServer): void {
  const innerServer = (server as unknown as { server: { _requestHandlers: Map<string, ToolsListHandler> } }).server;
  const originalToolsListHandler = innerServer._requestHandlers?.get('tools/list');
  if (originalToolsListHandler) {
    innerServer._requestHandlers.set('tools/list', async (req: unknown) => {
      const result = await originalToolsListHandler(req);
      for (const tool of result.tools) {
        const schema = tool['inputSchema'] as Record<string, unknown> | undefined;
        if (schema) {
          delete schema['$schema'];
          delete schema['additionalProperties'];
        }
      }
      return result;
    });
  } else {
    logger.error('Original tools list handler is undefined');
  }
}
