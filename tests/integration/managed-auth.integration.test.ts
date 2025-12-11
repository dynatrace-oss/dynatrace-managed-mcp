import { ManagedAuthClient } from '../../src/authentication/managed-auth-client';
import { getManagedEnvironmentConfig } from '../../src/utils/environment';
import { config } from 'dotenv';

// Load environment variables
config();

let skip = false;
if (!process.env.DT_MANAGED_ENVIRONMENT || !process.env.DT_MANAGED_API_TOKEN) {
  console.log('Skipping integration tests - environment not configured');
  skip = true;
}

(skip ? describe.skip : describe)('ManagedAuthClient Integration', () => {
  let client: ManagedAuthClient;

  beforeAll(() => {
    const config = getManagedEnvironmentConfig();
    client = new ManagedAuthClient(config.environment, config.apiToken);
  });

  afterAll(async () => {
    // Clean up any open handles
    if (client) {
      client.cleanup();
    }
  });

  it('should validate connection to real Managed cluster', async () => {
    const isValid = await client.validateConnection();
    expect(isValid).toBe(true);
  }, 30000);

  it('should get cluster version from real Managed cluster', async () => {
    const version = await client.getClusterVersion();
    expect(version).toHaveProperty('version');
    expect(typeof version.version).toBe('string');
    expect(version.version).toMatch(/^\d+\.\d+\.\d+/);
    console.log(`version=${JSON.stringify(version)}`);
  }, 30000);

  it('should validate minimum version requirement', async () => {
    const version = await client.getClusterVersion();
    const isValidVersion = await client.validateMinimumVersion(version);
    expect(typeof isValidVersion).toBe('boolean');
  }, 30000);
});
