import { getManagedEnvironmentConfig } from '../environment';

describe('getManagedEnvironmentConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {};
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return config with required environment variables', () => {
    process.env.DT_MANAGED_ENVIRONMENT = 'https://managed.test.com';
    process.env.DT_MANAGED_API_TOKEN = 'test-token';

    const config = getManagedEnvironmentConfig();

    expect(config).toEqual({
      environment: 'https://managed.test.com',
      apiToken: 'test-token',
    });
  });

  it('should remove trailing slash from environment URL', () => {
    process.env.DT_MANAGED_ENVIRONMENT = 'https://managed.test.com/';
    process.env.DT_MANAGED_API_TOKEN = 'test-token';

    const config = getManagedEnvironmentConfig();

    expect(config.environment).toBe('https://managed.test.com');
  });

  it('should throw error when DT_MANAGED_ENVIRONMENT is missing', () => {
    process.env.DT_MANAGED_API_TOKEN = 'test-token';

    expect(() => getManagedEnvironmentConfig()).toThrow('DT_MANAGED_ENVIRONMENT is required');
  });

  it('should throw error when DT_MANAGED_API_TOKEN is missing', () => {
    process.env.DT_MANAGED_ENVIRONMENT = 'https://managed.test.com';

    expect(() => getManagedEnvironmentConfig()).toThrow('DT_MANAGED_API_TOKEN is required');
  });
});
