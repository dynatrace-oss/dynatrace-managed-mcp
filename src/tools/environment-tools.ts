import { ToolContext } from './context';
import { logger } from '../utils/logger';
import { ManagedAuthClient } from '../authentication/managed-auth-client';
import { MANAGED_API_SCOPES } from '../authentication/managed-api-scopes';

export function registerEnvironmentTools(ctx: ToolContext): void {
  ctx.tool(
    'dynatrace_managed_get_environments_info',
    'Get information about all connected Dynatrace Managed clusters and verify the connections and authentication services.',
    {},
    {
      readOnlyHint: true,
    },
    async () => {
      let resp = `Dynatrace Managed Cluster Information:\n\n`;

      // stdio is single-user and local: config tokens are validated once at startup, so report from
      // the cached results instead of re-probing the cluster on every call.
      if (!ctx.httpMode) {
        for (const authClient of ctx.authClientManager.rawClients) {
          resp += `- Environment Alias: ${authClient.alias}\n`;
          resp += `- API URL: ${authClient.apiBaseUrl}\n`;
          resp += `- Dashboard URL: ${authClient.dashboardBaseUrl}\n`;
          resp += stdioModeVersionResponse(authClient);
        }
        return resp;
      }

      // HTTP: validate each supplied token live. The uniform error for unknown aliases and invalid
      // tokens keeps callers from enumerating which environments are configured.
      for (const alias of ctx.authClientManager.suppliedAliases()) {
        const token = ctx.authClientManager.tokenFor(alias);
        const authClient = ctx.authClientManager.rawClients.find((client) => client.alias === alias);

        if (token === undefined || authClient === undefined || !(await authClient.validateAPIToken(token))) {
          logger.error(`Invalid token supplied for ${alias} environment.`);
          resp += `Invalid token supplied for ${alias} environment.\n`;
          continue;
        }

        resp += `- Environment Alias: ${authClient.alias}\n`;
        resp += `- API URL: ${authClient.apiBaseUrl}\n`;
        resp += `- Dashboard URL: ${authClient.dashboardBaseUrl}\n`;
        resp += await httpModeVersionResponse(authClient, ctx);
      }

      return resp;
    },
  );
}

function errorMessageForResponse(error: unknown, environmentAlias: string) {
  let resp: string = '';
  resp += `- Valid Environment: No\n`;
  if (error instanceof Error) {
    resp += `- Error message: Failed to connect to environment ${environmentAlias}: ${error.message}\n\n`;
  } else {
    resp += 'Unknown error\n\n';
  }
  return resp;
}

function stdioModeVersionResponse(authClient: ManagedAuthClient) {
  let resp: string = '';
  if (!authClient.isValid) {
    resp += `- Valid Environment: No\n`;
    resp += `- Error message: ${authClient.validationError || 'Environment failed startup validation'}\n\n`;
    return resp;
  }
  resp += `- Valid Environment: Yes\n`;
  if (authClient.clusterVersion) {
    resp += `- Version: ${authClient.clusterVersion}\n`;
    resp += `- Minimum Version Check: PASSED\n`;
  }
  resp += `- Available API Scopes: ${MANAGED_API_SCOPES.join(', ')}\n\n\n`;
  return resp;
}

async function httpModeVersionResponse(authClient: ManagedAuthClient, ctx: ToolContext) {
  let resp: string = '';
  try {
    const clusterVersion = await authClient.getClusterVersion(ctx.authClientManager.tokenFor(authClient.alias) ?? '');
    const isValidVersion = authClient.validateMinimumVersion(clusterVersion);
    resp += `- Valid Environment: Yes\n`;
    resp += `- Version: ${clusterVersion.version}\n`;
    resp += `- Minimum Version Check: ${isValidVersion ? 'PASSED' : 'WARNING - Version may not be fully compatible and may not support all features'}\n`;
    resp += `- Available API Scopes: ${MANAGED_API_SCOPES.join(', ')}\n\n\n`;
  } catch (error) {
    resp += errorMessageForResponse(error, authClient.alias);
  }

  return resp;
}
