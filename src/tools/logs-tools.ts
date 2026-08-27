import { z } from 'zod';
import { ToolContext } from './context';
import { QueryLogsArgs } from './types';

export function registerLogsTools(ctx: ToolContext): void {
  ctx.tool<QueryLogsArgs>(
    'dynatrace_managed_query_logs',
    `Search logs using simple text queries. Results include event types, expanded metadata fields
    (up to 8 fields), and enhanced error detection. Managed clusters support basic text search but
    not structured syntax like "content:" or "loglevel:".`,
    {
      query: z.string().describe(
        `Simple text to search for in log content (e.g., "error", "exception", "timeout").
          Do NOT use structured syntax like "content:error" - just use "error".`,
      ),
      from: z.string().describe('Start time (ISO format or relative like "now-1h")'),
      to: z.string().describe('End time (ISO format or relative like "now")'),
      limit: z
        .number()
        .max(1000)
        .optional()
        .describe('Maximum number of logs to return (default: 100). Cannot exceed 1000'),
      sort: z.string().optional().describe('Sort order for logs. Use "-timestamp" for most recent first.'),
      environment_alias: z
        .string()
        .describe(
          'Specify which environment to be queried, by supplying the environment alias as returned ' +
            'by get_environments_info. Can use `ALL_ENVIRONMENTS` to retrieve data from all environments in ' +
            'one request to MCP.',
        )
        .refine((alias) => ctx.envAliasValidate(alias), {
          message: 'Environment alias(es) not valid. Options are: ' + ctx.authClientManager.validAliases.join(', '),
        }),
    },
    {
      readOnlyHint: true,
    },
    async ({ query, from, to, limit, sort, environment_alias }) => {
      const responses = await ctx.logsClient.queryLogs(
        {
          query: query,
          from: from,
          to: to,
          limit: limit,
          sort: sort,
        },
        environment_alias,
      );
      return ctx.logsClient.formatList(responses);
    },
  );
}
