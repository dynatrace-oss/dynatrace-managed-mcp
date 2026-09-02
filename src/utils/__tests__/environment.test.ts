import { getManagedEnvironmentConfigs, validateEnvironments, buildConfigTokenMap } from '../environment';

describe('getManagedEnvironmentConfig', () => {
  const originalEnv = process.env;
  const fullEnv =
    '[' +
    '{' +
    '    "dynatraceUrl": "https://my-dashboard-endpoint.com/",' +
    '    "apiEndpointUrl": "https://my-api-endpoint.com/",' +
    '    "environmentId": "my-env-id-1",' +
    '    "alias": "alias-env-id-1",' +
    '    "apiToken": "my-api-token",' +
    '    "httpsProxyUrl": ""' +
    '  },' +
    '  {' +
    '    "dynatraceUrl": "https://my-dashboard-endpoint.com",' +
    '    "apiEndpointUrl": "https://my-api-endpoint.com",' +
    '    "environmentId": "my-env-id-2",' +
    '    "alias": "invalid-alias-env-id;-2",' +
    '    "apiToken": "my-api-token",' +
    '    "httpProxyUrl": "",' +
    '    "httpsProxyUrl": ""' +
    '  },' +
    '  {' +
    '    "dynatraceUrl": "https://my-dashboard-endpoint.com",' +
    '    "apiEndpointUrl": "https://my-api-endpoint.com",' +
    '    "environmentId": "my-env-id-3",' +
    '    "alias": "missing-api-key-env-id-3",' +
    '    "httpProxyUrl": "",' +
    '    "httpsProxyUrl": ""' +
    '  },' +
    '  {' +
    '    "apiEndpointUrl": "https://my-api-endpoint.com",' +
    '    "environmentId": "my-env-id-4",' +
    '    "alias": "only-required-keys-env-4",' +
    '    "apiToken": "my-api-token"' +
    '  },' +
    '  {' +
    '    "dynatraceUrl": "https://my-dashboard-endpoint.com",' +
    '    "environmentId": "my-env-id-5",' +
    '    "alias": "missing-api-url-env-5",' +
    '    "apiToken": "my-api-token",' +
    '    "httpProxyUrl": "",' +
    '    "httpsProxyUrl": ""' +
    '  }' +
    ']';

  beforeEach(() => {
    process.env = {};
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return configs with environments', () => {
    process.env.DT_ENVIRONMENT_CONFIGS = fullEnv;

    const config = getManagedEnvironmentConfigs();
    expect(config).toEqual([
      {
        environmentId: 'my-env-id-1',
        apiUrl: 'https://my-api-endpoint.com/e/my-env-id-1',
        dashboardUrl: 'https://my-dashboard-endpoint.com/e/my-env-id-1',
        apiToken: 'my-api-token',
        alias: 'alias-env-id-1',
        httpProxy: '',
        httpsProxy: '',
      },
      {
        environmentId: 'my-env-id-2',
        apiUrl: 'https://my-api-endpoint.com/e/my-env-id-2',
        dashboardUrl: 'https://my-dashboard-endpoint.com/e/my-env-id-2',
        apiToken: 'my-api-token',
        alias: 'invalid-alias-env-id;-2',
        httpProxy: '',
        httpsProxy: '',
      },
      {
        environmentId: 'my-env-id-3',
        apiUrl: 'https://my-api-endpoint.com/e/my-env-id-3',
        dashboardUrl: 'https://my-dashboard-endpoint.com/e/my-env-id-3',
        apiToken: '',
        alias: 'missing-api-key-env-id-3',
        httpProxy: '',
        httpsProxy: '',
      },
      {
        environmentId: 'my-env-id-4',
        apiUrl: 'https://my-api-endpoint.com/e/my-env-id-4',
        dashboardUrl: 'https://my-api-endpoint.com/e/my-env-id-4',
        apiToken: 'my-api-token',
        alias: 'only-required-keys-env-4',
        httpProxy: '',
        httpsProxy: '',
      },
      {
        environmentId: 'my-env-id-5',
        dashboardUrl: 'https://my-dashboard-endpoint.com/e/my-env-id-5',
        apiUrl: '',
        apiToken: 'my-api-token',
        alias: 'missing-api-url-env-5',
        httpProxy: '',
        httpsProxy: '',
      },
    ]);
  });

  it('should return only valid environments', () => {
    process.env.DT_ENVIRONMENT_CONFIGS = fullEnv;

    const config = getManagedEnvironmentConfigs();
    const validatedConfigs = validateEnvironments(config);

    const validConfigs = validatedConfigs['valid_configs'];
    const errors = validatedConfigs['errors'];

    expect(validConfigs).toEqual([
      {
        environmentId: 'my-env-id-1',
        apiUrl: 'https://my-api-endpoint.com/e/my-env-id-1',
        dashboardUrl: 'https://my-dashboard-endpoint.com/e/my-env-id-1',
        apiToken: 'my-api-token',
        alias: 'alias-env-id-1',
        httpProxy: '',
        httpsProxy: '',
      },
      {
        environmentId: 'my-env-id-4',
        apiUrl: 'https://my-api-endpoint.com/e/my-env-id-4',
        dashboardUrl: 'https://my-api-endpoint.com/e/my-env-id-4',
        apiToken: 'my-api-token',
        alias: 'only-required-keys-env-4',
        httpProxy: '',
        httpsProxy: '',
      },
    ]);

    expect(errors).toEqual([
      'Invalid alias found: "invalid-alias-env-id;-2". Aliases are mandatory and cannot contain semicolons.',
      'Key "apiToken" is empty or missing (environment #2, alias: missing-api-key-env-id-3). Please make sure all values are present and populated in the configuration array.',
      'Key "apiEndpointUrl" is empty or missing (environment #4, alias: missing-api-url-env-5). Please make sure all values are present and populated in the configuration array.',
    ]);
  });

  it('should throw error when DT_ENVIRONMENT_CONFIGS is missing', () => {
    process.env = {};
    expect(() => getManagedEnvironmentConfigs()).toThrow('Configuration not found');
  });

  it('should remove trailing slash from environment URL', () => {
    process.env.DT_ENVIRONMENT_CONFIGS = fullEnv;
    const config = getManagedEnvironmentConfigs();
    const validatedConfigs = validateEnvironments(config);
    const validConfigWithTrailingSlash = validatedConfigs['valid_configs'][0];

    expect(validConfigWithTrailingSlash).toEqual({
      environmentId: 'my-env-id-1',
      apiUrl: 'https://my-api-endpoint.com/e/my-env-id-1',
      dashboardUrl: 'https://my-dashboard-endpoint.com/e/my-env-id-1',
      apiToken: 'my-api-token',
      alias: 'alias-env-id-1',
      httpProxy: '',
      httpsProxy: '',
    });
  });

  it('should default dashboard url to api base url', () => {
    process.env.DT_ENVIRONMENT_CONFIGS = fullEnv;
    const config = getManagedEnvironmentConfigs();
    const validatedConfigs = validateEnvironments(config);
    const validConfigOnlyRequiredFields = validatedConfigs['valid_configs'][1];

    expect(validConfigOnlyRequiredFields).toEqual({
      environmentId: 'my-env-id-4',
      apiUrl: 'https://my-api-endpoint.com/e/my-env-id-4',
      dashboardUrl: 'https://my-api-endpoint.com/e/my-env-id-4',
      apiToken: 'my-api-token',
      alias: 'only-required-keys-env-4',
      httpProxy: '',
      httpsProxy: '',
    });
  });

  it('does not require apiToken when requireToken is false (HTTP mode)', () => {
    process.env.DT_ENVIRONMENT_CONFIGS = fullEnv;
    const config = getManagedEnvironmentConfigs();
    const validated = validateEnvironments(config, false);
    const aliases = validated.valid_configs.map((c) => c.alias);

    // Env #3 has no apiToken — valid in HTTP mode.
    expect(aliases).toContain('missing-api-key-env-id-3');
    // Structural problems are still rejected regardless of token mode.
    expect(aliases).not.toContain('invalid-alias-env-id;-2'); // semicolon in alias
    expect(aliases).not.toContain('missing-api-url-env-5'); // missing apiEndpointUrl
  });

  it('keeps the first environment for an alias and rejects later duplicates', () => {
    const base = { apiUrl: 'u', dashboardUrl: 'd', apiToken: 't' };
    const validated = validateEnvironments([
      { ...base, alias: 'prod', environmentId: 'env-1' },
      { ...base, alias: 'prod', environmentId: 'env-2' },
      { ...base, alias: 'staging', environmentId: 'env-3' },
    ]);

    expect(validated.errors.length).toBeGreaterThan(0);
    expect(validated.errors).toEqual(['Duplicate alias found: "prod". Aliases must be unique across environments.']);
  });

  it('reports one error per extra occurrence of a repeated alias', () => {
    const base = { apiUrl: 'u', dashboardUrl: 'd', environmentId: 'e', apiToken: 't' };
    const validated = validateEnvironments([
      { ...base, alias: 'prod' },
      { ...base, alias: 'prod' },
      { ...base, alias: 'prod' },
    ]);

    expect(validated.errors).toHaveLength(2);
  });

  it('does not raise a duplicate error for environments with a missing alias', () => {
    const base = { apiUrl: 'u', dashboardUrl: 'd', environmentId: 'e', apiToken: 't' };
    const validated = validateEnvironments([
      { ...base, alias: '' },
      { ...base, alias: '' },
    ]);

    expect(validated.valid_configs).toEqual([]);
    expect(validated.errors.some((error) => error.includes('Duplicate alias'))).toBe(false);
  });

  it('buildConfigTokenMap maps alias -> token and skips empty tokens', () => {
    const map = buildConfigTokenMap([
      { alias: 'a', apiToken: 't1', apiUrl: 'u', dashboardUrl: 'd', environmentId: 'e' },
      { alias: 'b', apiToken: '', apiUrl: 'u', dashboardUrl: 'd', environmentId: 'e' },
    ]);
    expect(map.get('a')).toBe('t1');
    expect(map.has('b')).toBe(false);
  });
});
