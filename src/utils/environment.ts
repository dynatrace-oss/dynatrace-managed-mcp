export interface ManagedEnvironmentConfig {
  environment: string;
  apiToken: string;
}

export function getManagedEnvironmentConfig(): ManagedEnvironmentConfig {
  const environment = process.env.DT_MANAGED_ENVIRONMENT;
  const apiToken = process.env.DT_MANAGED_API_TOKEN;

  if (!environment) {
    throw new Error('DT_MANAGED_ENVIRONMENT is required');
  }

  if (!apiToken) {
    throw new Error('DT_MANAGED_API_TOKEN is required');
  }

  return {
    environment: environment.replace(/\/$/, ''), // Remove trailing slash
    apiToken,
  };
}
