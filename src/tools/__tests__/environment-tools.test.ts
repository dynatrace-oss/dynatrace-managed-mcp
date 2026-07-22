import { registerEnvironmentTools } from '../environment-tools';
import { ToolContext } from '../context';
import { ManagedAuthClient, ManagedAuthClientManager } from '../../authentication/managed-auth-client';

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
  logErrorObject: jest.fn(),
}));

type EnvInfoCallback = () => Promise<string>;

const HEADER = 'Dynatrace Managed Cluster Information:\n\n';

interface MockClientOptions {
  validToken?: boolean; // HTTP: result of the live validateAPIToken lookup
  isValid?: boolean; // stdio: cached startup validity
  version?: string;
  minimumVersionOk?: boolean;
  validationError?: string; // stdio: cached startup error
}

function mockClient(alias: string, options: MockClientOptions = {}): ManagedAuthClient {
  const {
    validToken = false,
    isValid = false,
    version = '1.345.0',
    minimumVersionOk = true,
    validationError = '',
  } = options;
  return {
    alias,
    apiBaseUrl: `http://api/${alias}`,
    dashboardBaseUrl: `http://dashboard/${alias}`,
    isValid,
    clusterVersion: isValid ? version : '',
    validationError,
    validateAPIToken: jest.fn().mockResolvedValue(validToken),
    getClusterVersion: jest.fn().mockResolvedValue({ version }),
    validateMinimumVersion: jest.fn().mockReturnValue(minimumVersionOk),
  } as unknown as ManagedAuthClient;
}

function registerAndCapture(
  rawClients: ManagedAuthClient[],
  suppliedTokens: Map<string, string>,
  httpMode: boolean,
): EnvInfoCallback {
  let callback: EnvInfoCallback | undefined;

  const authClientManager = {
    rawClients,
    suppliedAliases: () => [...suppliedTokens.keys()],
    tokenFor: (alias: string) => suppliedTokens.get(alias),
    MINIMUM_VERSION: '1.328.0',
  } as unknown as ManagedAuthClientManager;

  const ctx = {
    tool: (_name: string, _description: string, _schema: unknown, _annotations: unknown, cb: EnvInfoCallback) => {
      callback = cb;
    },
    authClientManager,
    httpMode,
    initErrors: [],
  } as unknown as ToolContext;

  registerEnvironmentTools(ctx);

  if (!callback) {
    throw new Error('get_environments_info was not registered');
  }
  return callback;
}

describe('get_environments_info (HTTP mode)', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns full details for a supplied alias with a valid token', async () => {
    const run = registerAndCapture([mockClient('onPrem', { validToken: true })], new Map([['onPrem', 'good']]), true);

    const result = await run();

    expect(result).toContain('- Environment Alias: onPrem');
    expect(result).toContain('- API URL: http://api/onPrem');
    expect(result).toContain('- Dashboard URL: http://dashboard/onPrem');
    expect(result).toContain('- Valid Environment: Yes');
    expect(result).toContain('- Version: 1.345.0');
    expect(result).toContain('- Minimum Version Check: PASSED');
    expect(result).toContain('DataExport');
    expect(result).not.toContain('Invalid token supplied');
  });

  it('returns a uniform invalid-token message for a real alias whose token fails validation', async () => {
    const run = registerAndCapture([mockClient('onPrem', { validToken: false })], new Map([['onPrem', 'bad']]), true);

    const result = await run();

    expect(result).toBe(`${HEADER}Invalid token supplied for onPrem environment.\n`);
    expect(result).not.toContain('API URL');
    expect(result).not.toContain('Valid Environment: Yes');
  });

  it('returns the same message for an unknown alias without probing the cluster or revealing configured envs', async () => {
    const configured = mockClient('onPrem', { validToken: true });
    const run = registerAndCapture([configured], new Map([['ghost', 'whatever']]), true);

    const result = await run();

    expect(result).toBe(`${HEADER}Invalid token supplied for ghost environment.\n`);
    expect(result).not.toContain('onPrem');
    expect(configured.validateAPIToken).not.toHaveBeenCalled();
  });

  it('is indistinguishable between a real bad-token alias and an unknown alias', async () => {
    const realBadToken = await registerAndCapture(
      [mockClient('target', { validToken: false })],
      new Map([['target', 'bad']]),
      true,
    )();

    const unknownAlias = await registerAndCapture(
      [mockClient('target', { validToken: false })],
      new Map([['ghost', 'bad']]),
      true,
    )();

    // The only difference in the two responses is the alias the caller themselves supplied.
    expect(realBadToken.replace('target', 'ALIAS')).toBe(unknownAlias.replace('ghost', 'ALIAS'));
  });

  it('does not list configured environments the caller did not supply a token for', async () => {
    const onPrem = mockClient('onPrem', { validToken: true });
    const hidden = mockClient('super-secret-prod', { validToken: true });
    const run = registerAndCapture([onPrem, hidden], new Map([['onPrem', 'good']]), true);

    const result = await run();

    expect(result).toContain('- Environment Alias: onPrem');
    expect(result).not.toContain('super-secret-prod');
    expect(hidden.validateAPIToken).not.toHaveBeenCalled();
  });
});

describe('get_environments_info (stdio mode)', () => {
  afterEach(() => jest.clearAllMocks());

  it('reports configured environments from cached startup validation without probing the cluster', async () => {
    const local = mockClient('local', { isValid: true, version: '1.345.0' });
    const run = registerAndCapture([local], new Map([['local', 'config-token']]), false);

    const result = await run();

    expect(result).toContain('- Environment Alias: local');
    expect(result).toContain('- Valid Environment: Yes');
    expect(result).toContain('- Version: 1.345.0');
    expect(result).toContain('- Minimum Version Check: PASSED');
    // Regression guard: stdio must not make live validation/version calls (uses cached results).
    expect(local.validateAPIToken).not.toHaveBeenCalled();
    expect(local.getClusterVersion).not.toHaveBeenCalled();
  });

  it('shows environments that failed startup validation using the cached error', async () => {
    const broken = mockClient('broken', { isValid: false, validationError: 'boom' });
    const run = registerAndCapture([broken], new Map(), false);

    const result = await run();

    expect(result).toContain('- Environment Alias: broken');
    expect(result).toContain('- Valid Environment: No');
    expect(result).toContain('boom');
    expect(broken.validateAPIToken).not.toHaveBeenCalled();
  });
});
