import { ToolContext } from './context';

// Required API scopes for Managed deployment
const MANAGED_API_SCOPES = [
  'DataExport', // Read metrics and topology
  'ReadConfig', // Read configuration and cluster version
  'ReadSyntheticData', // Read synthetic monitoring data
  'ReadLogContent', // Read log content
  'ReadEvents', // Read events
  'ReadProblems', // Read problems and root cause analysis
  'ReadSecurityProblems', // Read security problems
  'ReadSLO', // Read Service Level Objectives
];

export function registerEnvironmentTools(ctx: ToolContext): void {
  ctx.tool(
    'dynatrace_managed_check_config_errors',
    'Returns information about environment configurations and any potential error found during initialization',
    {},
    {
      readOnlyHint: true,
    },
    async () => {
      let resp = `Dynatrace Managed Environments Information - Listing configuration errors found during initialization:\n\n`;
      if (ctx.initErrors.length > 0) {
        resp += `Issues where found in environment configurations during start up: \n`;
        for (const errorMessage of ctx.initErrors) {
          resp += `- ${errorMessage}\n`;
        }
        resp += `\nPlease review all environment information and try again. \n`;
      }

      return resp;
    },
  );

  ctx.tool(
    'dynatrace_managed_get_environments_info',
    'Get information about all connected Dynatrace Managed clusters and verify the connections and authentication services.',
    {},
    {
      readOnlyHint: true,
    },
    async () => {
      let resp = `Dynatrace Managed Cluster Information - Listing info for ${ctx.authClientManager.rawClients.length} environments:\n\n`;

      for (const authClient of ctx.authClientManager.rawClients) {
        resp += `- Environment Alias: ${authClient.alias}\n`;
        resp += `- API URL: ${authClient.apiBaseUrl}\n`;
        resp += `- Dashboard URL: ${authClient.dashboardBaseUrl}\n`;

        // In stdio mode, use cached startup validation results to avoid redundant live probes.
        if (!ctx.httpMode) {
          if (authClient.isValid) {
            resp += `- Valid Environment: Yes\n`;
            if (authClient.clusterVersion) {
              resp += `- Version: ${authClient.clusterVersion}\n`;
              resp += `- Minimum Version Check: PASSED\n`;
            }
            resp += `- Available API Scopes: ${MANAGED_API_SCOPES.join(', ')}\n\n\n`;
          } else {
            resp += `- Valid Environment: No\n`;
            resp += `- Error message: ${authClient.validationError || 'Environment failed startup validation'}\n\n`;
          }
          continue;
        }

        // HTTP mode: probe live because tokens are supplied per request.
        const token = ctx.authClientManager.tokenFor(authClient.alias);
        if (!token) {
          resp += `- Valid Environment: No\n`;
          resp += `- Error message: No token supplied for this environment. Add \`${authClient.alias}=<token>\` to your X-Dynatrace-Tokens header to query it.\n\n`;
          continue;
        }

        try {
          const clusterVersion = await authClient.getClusterVersion(token);
          const isValidVersion = authClient.validateMinimumVersion(clusterVersion);
          resp += `- Valid Environment: Yes\n`;
          resp += `- Version: ${clusterVersion.version}\n`;
          resp += `- Minimum Version Check: ${isValidVersion ? 'PASSED' : 'WARNING - Version may not be fully compatible and may not support all features'}\n`;
          resp += `- Available API Scopes: ${MANAGED_API_SCOPES.join(', ')}\n\n\n`;
        } catch (error) {
          resp += `- Valid Environment: No\n`;
          if (error instanceof Error) {
            resp += `- Error message: Failed to connect to environment ${authClient.alias}: ${error.message}\n\n`;
          } else {
            resp += 'Unknown error\n\n';
          }
        }
      }

      if (ctx.initErrors.length > 0) {
        resp += `Issues were found in environment configurations during start up: \n`;
        for (const errorMessage of ctx.initErrors) {
          resp += `- ${errorMessage}\n`;
        }
        resp += `\nPlease review all environments connection information. \n`;
      }

      resp += `\n\n\nAll Dynatrace Managed Cluster Environments listed. Environment showing connection errors and environments with "Valid environment" set to "No" are invalid environments.\n\n`;

      return resp;
    },
  );
}
