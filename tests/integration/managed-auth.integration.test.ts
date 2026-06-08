import { ManagedAuthClient } from '../../src/authentication/managed-auth-client';
import { getManagedEnvironmentConfigs, validateEnvironments } from '../../src/utils/environment';
import { config } from 'dotenv';

// Load environment variables
config();

let skip = false;
if (!process.env.DT_ENVIRONMENT_CONFIGS) {
  console.log('Skipping integration tests - environment not configured');
  skip = true;
}

(skip ? describe.skip : describe)('ManagedAuthClient Integration', () => {
  let client: ManagedAuthClient;
  let apiToken: string;

  beforeAll(() => {
    const config = getManagedEnvironmentConfigs();
    const environments = validateEnvironments(config);
    const valid_client = environments['valid_configs'][0];
    apiToken = valid_client.apiToken;

    client = new ManagedAuthClient({
      apiBaseUrl: valid_client.apiUrl,
      dashboardBaseUrl: valid_client.dashboardUrl,
      alias: valid_client.alias,
      minimum_version: '1.328.0',
    });
  });

  afterAll(async () => {
    if (client) {
      client.cleanup();
    }
  });

  it('should validate connection to real Managed cluster', async () => {
    const isValid = await client.validateConnection(apiToken);
    expect(isValid).toBe(true);
  }, 30000);

  it('should get cluster version from real Managed cluster', async () => {
    const version = await client.getClusterVersion(apiToken);
    expect(version).toHaveProperty('version');
    expect(typeof version.version).toBe('string');
    expect(version.version).toMatch(/^\d+\.\d+\.\d+/);
  }, 30000);

  it('should validate minimum version requirement', async () => {
    const version = await client.getClusterVersion(apiToken);
    const isValidVersion = client.validateMinimumVersion(version);
    expect(typeof isValidVersion).toBe('boolean');
  }, 30000);
});
