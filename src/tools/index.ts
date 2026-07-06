import { ToolContext } from './context';
import { registerEnvironmentTools } from './environment-tools';
import { registerMetricsTools } from './metrics-tools';
import { registerLogsTools } from './logs-tools';
import { registerEventsTools } from './events-tools';
import { registerEntitiesTools } from './entities-tools';
import { registerProblemsTools } from './problems-tools';
import { registerSecurityTools } from './security-tools';
import { registerSloTools } from './slo-tools';

export { ToolContext } from './context';

/**
 * Registers every Dynatrace Managed tool on the McpServer via the supplied context.
 */
export function registerAllTools(ctx: ToolContext): void {
  registerEnvironmentTools(ctx);
  registerMetricsTools(ctx);
  registerLogsTools(ctx);
  registerEventsTools(ctx);
  registerEntitiesTools(ctx);
  registerProblemsTools(ctx);
  registerSecurityTools(ctx);
  registerSloTools(ctx);
}
