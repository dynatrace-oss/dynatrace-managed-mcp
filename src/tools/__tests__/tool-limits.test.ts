import { z, ZodNumber, ZodOptional, ZodRawShape, ZodTypeAny } from 'zod';
import { registerAllTools } from '../index';
import { ToolContext } from '../context';
import {
  MAX_ENTITIES_LIMIT,
  MAX_EVENTS_LIMIT,
  MAX_LOGS_LIMIT,
  MAX_METRICS_LIMIT,
  MAX_PROBLEMS_LIMIT,
  MAX_SECURITY_PROBLEMS_LIMIT,
  MAX_SLOS_LIMIT,
} from '../limits';
import { EntitiesApiClient } from '../../capabilities/entities-api';
import { EventsApiClient } from '../../capabilities/events-api';
import { LogsApiClient } from '../../capabilities/logs-api';
import { MetricsApiClient } from '../../capabilities/metrics-api';
import { ProblemsApiClient } from '../../capabilities/problems-api';
import { SecurityApiClient } from '../../capabilities/security-api';
import { SloApiClient } from '../../capabilities/slo-api';

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
  logErrorObject: jest.fn(),
}));

const VALID_ALIAS = 'onPrem';

/**
 * Registers every tool against a stub context and returns the raw zod shape each tool declared,
 * keyed by tool name. This is the exact schema the MCP SDK validates incoming tool calls against.
 */
function captureToolSchemas(): Map<string, ZodRawShape> {
  const schemas = new Map<string, ZodRawShape>();

  const ctx = {
    tool: (name: string, _description: string, paramsSchema: ZodRawShape) => {
      schemas.set(name, paramsSchema);
    },
    authClientManager: { validAliases: [VALID_ALIAS] },
    envAliasValidate: (alias: string) => alias === VALID_ALIAS,
    initErrors: [],
    httpMode: false,
  } as unknown as ToolContext;

  registerAllTools(ctx);
  return schemas;
}

/** Returns the `.max()` bound of a (possibly optional) number schema, or null when uncapped. */
function maxValueOf(schema: ZodTypeAny): number | null {
  const inner = schema instanceof ZodOptional ? (schema.unwrap() as ZodTypeAny) : schema;
  return inner instanceof ZodNumber ? inner.maxValue : null;
}

interface LimitedTool {
  name: string;
  max: number;
  fallback: number;
  requiredArgs: Record<string, unknown>;
}

const LIMITED_TOOLS: LimitedTool[] = [
  {
    name: 'dynatrace_managed_discover_entities',
    max: MAX_ENTITIES_LIMIT,
    fallback: EntitiesApiClient.API_PAGE_SIZE,
    requiredArgs: { entitySelector: 'type("SERVICE")' },
  },
  {
    name: 'dynatrace_managed_list_events',
    max: MAX_EVENTS_LIMIT,
    fallback: EventsApiClient.API_PAGE_SIZE,
    requiredArgs: { from: 'now-1h', to: 'now' },
  },
  {
    name: 'dynatrace_managed_query_logs',
    max: MAX_LOGS_LIMIT,
    fallback: LogsApiClient.DEFAULT_PAGE_SIZE,
    requiredArgs: { query: 'error', from: 'now-1h', to: 'now' },
  },
  {
    name: 'dynatrace_managed_list_available_metrics',
    max: MAX_METRICS_LIMIT,
    fallback: MetricsApiClient.API_PAGE_SIZE,
    requiredArgs: {},
  },
  {
    name: 'dynatrace_managed_list_problems',
    max: MAX_PROBLEMS_LIMIT,
    fallback: ProblemsApiClient.API_PAGE_SIZE,
    requiredArgs: {},
  },
  {
    name: 'dynatrace_managed_list_security_problems',
    max: MAX_SECURITY_PROBLEMS_LIMIT,
    fallback: SecurityApiClient.API_PAGE_SIZE,
    requiredArgs: {},
  },
  {
    name: 'dynatrace_managed_list_slos',
    max: MAX_SLOS_LIMIT,
    fallback: SloApiClient.API_PAGE_SIZE,
    requiredArgs: {},
  },
];

describe('tool `limit` parameter caps', () => {
  const schemas = captureToolSchemas();

  function shapeOf(name: string): ZodRawShape {
    const shape = schemas.get(name);
    if (!shape) {
      throw new Error(`${name} was not registered`);
    }
    return shape;
  }

  function parseArgs(tool: LimitedTool, limit?: number) {
    const args: Record<string, unknown> = {
      ...tool.requiredArgs,
      environment_alias: VALID_ALIAS,
      ...(limit !== undefined && { limit }),
    };
    return z.object(shapeOf(tool.name)).safeParse(args);
  }

  it('covers every registered tool that exposes a limit parameter', () => {
    const withLimit = [...schemas.entries()].filter(([, shape]) => 'limit' in shape).map(([name]) => name);

    expect(withLimit.sort()).toEqual(LIMITED_TOOLS.map((tool) => tool.name).sort());
  });

  it('leaves no limit parameter uncapped', () => {
    const uncapped = [...schemas.entries()]
      .filter(([, shape]) => 'limit' in shape && maxValueOf(shape.limit) === null)
      .map(([name]) => name);

    expect(uncapped).toEqual([]);
  });

  describe.each(LIMITED_TOOLS)('$name', (tool) => {
    it(`caps limit at ${tool.max}`, () => {
      expect(maxValueOf(shapeOf(tool.name).limit)).toBe(tool.max);
    });

    it('accepts a limit at the cap', () => {
      const result = parseArgs(tool, tool.max);

      expect(result.success).toBe(true);
      expect(result.success && result.data.limit).toBe(tool.max);
    });

    it('accepts a limit below the cap', () => {
      const result = parseArgs(tool, 1);

      expect(result.success).toBe(true);
      expect(result.success && result.data.limit).toBe(1);
    });

    it('rejects a limit one above the cap', () => {
      const result = parseArgs(tool, tool.max + 1);

      expect(result.success).toBe(false);
      expect(result.error?.issues).toContainEqual(
        expect.objectContaining({ code: 'too_big', maximum: tool.max, path: ['limit'] }),
      );
    });

    it('rejects an absurdly large limit', () => {
      const result = parseArgs(tool, Number.MAX_SAFE_INTEGER);

      expect(result.success).toBe(false);
      expect(result.error?.issues).toContainEqual(
        expect.objectContaining({ code: 'too_big', maximum: tool.max, path: ['limit'] }),
      );
    });

    it('keeps limit optional so callers fall back to the default page size', () => {
      const result = parseArgs(tool);

      expect(result.success).toBe(true);
      expect(result.success && result.data.limit).toBeUndefined();
    });

    it('documents the cap in the parameter description', () => {
      const description = (shapeOf(tool.name).limit as ZodTypeAny).description;

      expect(description).toContain(`Cannot exceed ${tool.max}`);
    });

    it('never falls back to a page size larger than the cap', () => {
      expect(tool.fallback).toBeLessThanOrEqual(tool.max);
    });
  });
});
