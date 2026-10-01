import * as vscode from 'vscode';
import {
  configureEnvironments,
  ensureEnvironmentConfigs,
  ManagedEnvironmentConfig,
  readEnvironmentConfigs,
} from '../config';

const SECRET_KEY = 'dynatraceManagedMcp.environmentConfigs';

const prod: ManagedEnvironmentConfig = {
  apiEndpointUrl: 'https://prod.example.com',
  environmentId: 'prod-env',
  alias: 'prod',
  apiToken: 'dt0c01.PROD',
};

const staging: ManagedEnvironmentConfig = {
  apiEndpointUrl: 'https://staging.example.com',
  environmentId: 'staging-env',
  alias: 'staging',
  apiToken: 'dt0c01.STAGING',
};

const showInputBox = vscode.window.showInputBox as jest.Mock;
const showQuickPick = vscode.window.showQuickPick as jest.Mock;

function createContext(initial?: ManagedEnvironmentConfig[] | string) {
  const store = new Map<string, string>();
  if (initial !== undefined) {
    store.set(SECRET_KEY, typeof initial === 'string' ? initial : JSON.stringify(initial));
  }

  const context = {
    secrets: {
      get: jest.fn(async (key: string) => store.get(key)),
      store: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      delete: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    },
  } as unknown as vscode.ExtensionContext;

  return { context, store };
}

function storedConfigs(store: Map<string, string>): ManagedEnvironmentConfig[] | undefined {
  const value = store.get(SECRET_KEY);
  return value === undefined ? undefined : JSON.parse(value);
}

function answerPrompts(...answers: Array<string | undefined>): void {
  answers.forEach((answer) => showInputBox.mockResolvedValueOnce(answer));
}

function answersFor(config: ManagedEnvironmentConfig): string[] {
  return [config.apiEndpointUrl, config.environmentId, config.alias, config.apiToken];
}

function validatorFor(promptIndex: number): (value: string) => string | undefined {
  return showInputBox.mock.calls[promptIndex][0].validateInput;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('readEnvironmentConfigs', () => {
  it.each([
    ['invalid JSON', 'not-json'],
    ['a non-array', JSON.stringify(prod)],
  ])('treats %s in storage as nothing stored', async (_description, value) => {
    const { context } = createContext(value);

    await expect(readEnvironmentConfigs(context)).resolves.toBeUndefined();
  });
});

describe('ensureEnvironmentConfigs', () => {
  it('returns the stored environments without prompting', async () => {
    const { context } = createContext([prod]);

    const result = await ensureEnvironmentConfigs(context);

    expect(JSON.parse(result!)).toEqual([prod]);
    expect(showInputBox).not.toHaveBeenCalled();
  });

  it('prompts for a first environment when nothing is stored, then trims and stores it', async () => {
    const { context, store } = createContext();
    answerPrompts(...answersFor(prod).map((answer) => `  ${answer}  `));

    const result = await ensureEnvironmentConfigs(context);

    expect(JSON.parse(result!)).toEqual([prod]);
    expect(storedConfigs(store)).toEqual([prod]);
  });

  it.each([0, 1, 2, 3])('stores nothing and returns undefined when prompt %i is dismissed', async (dismissed) => {
    const { context, store } = createContext();
    answerPrompts(...answersFor(prod).slice(0, dismissed), undefined);

    await expect(ensureEnvironmentConfigs(context)).resolves.toBeUndefined();
    expect(showInputBox).toHaveBeenCalledTimes(dismissed + 1);
    expect(store.has(SECRET_KEY)).toBe(false);
  });

  it('masks only the API token prompt', async () => {
    const { context } = createContext();
    answerPrompts(...answersFor(prod));

    await ensureEnvironmentConfigs(context);

    const masked = showInputBox.mock.calls.map(([options]) => options.password === true);
    expect(masked).toEqual([false, false, false, true]);
  });
});

describe('prompt validation', () => {
  beforeEach(async () => {
    showQuickPick.mockResolvedValueOnce({ id: 'add' });
    answerPrompts(...answersFor(staging));
    await configureEnvironments(createContext([prod]).context);
  });

  it('accepts only absolute http and https cluster URLs', () => {
    const validateUrl = validatorFor(0);

    expect(validateUrl('   ')).toBeDefined();
    expect(validateUrl('managed.example.com')).toBeDefined();
    expect(validateUrl('ftp://managed.example.com')).toBeDefined();
    expect(validateUrl('https://managed.example.com')).toBeUndefined();
    expect(validateUrl('http://managed.example.com')).toBeUndefined();
  });

  it('requires an environment ID and an API token', () => {
    expect(validatorFor(1)('   ')).toBeDefined();
    expect(validatorFor(1)('prod-env')).toBeUndefined();
    expect(validatorFor(3)('   ')).toBeDefined();
    expect(validatorFor(3)('dt0c01.PROD')).toBeUndefined();
  });

  it('rejects blank, semicolon and already configured aliases', () => {
    const validateAlias = validatorFor(2);

    expect(validateAlias('   ')).toBeDefined();
    expect(validateAlias('prod;eu')).toBeDefined();
    expect(validateAlias('prod')).toBeDefined();
    expect(validateAlias(' prod ')).toBeDefined();
    expect(validateAlias('staging')).toBeUndefined();
  });
});

describe('configureEnvironments', () => {
  it('adds a first environment without asking what to do when none are stored', async () => {
    const { context, store } = createContext();
    answerPrompts(...answersFor(prod));

    await expect(configureEnvironments(context)).resolves.toBe(true);
    expect(showQuickPick).not.toHaveBeenCalled();
    expect(storedConfigs(store)).toEqual([prod]);
  });

  it('returns false and changes nothing when the action picker is dismissed', async () => {
    const { context, store } = createContext([prod]);
    showQuickPick.mockResolvedValueOnce(undefined);

    await expect(configureEnvironments(context)).resolves.toBe(false);
    expect(storedConfigs(store)).toEqual([prod]);
  });

  it('appends an added environment to the stored ones', async () => {
    const { context, store } = createContext([prod]);
    showQuickPick.mockResolvedValueOnce({ id: 'add' });
    answerPrompts(...answersFor(staging));

    await expect(configureEnvironments(context)).resolves.toBe(true);
    expect(storedConfigs(store)).toEqual([prod, staging]);
  });

  it('returns false and changes nothing when adding is cancelled', async () => {
    const { context, store } = createContext([prod]);
    showQuickPick.mockResolvedValueOnce({ id: 'add' });
    answerPrompts(undefined);

    await expect(configureEnvironments(context)).resolves.toBe(false);
    expect(storedConfigs(store)).toEqual([prod]);
  });

  it('removes the picked environment and deletes the secret once none are left', async () => {
    const { context, store } = createContext([prod, staging]);
    showQuickPick
      .mockResolvedValueOnce({ id: 'remove' })
      .mockResolvedValueOnce({ label: 'prod' })
      .mockResolvedValueOnce({ id: 'remove' })
      .mockResolvedValueOnce({ label: 'staging' });

    await expect(configureEnvironments(context)).resolves.toBe(true);
    expect(storedConfigs(store)).toEqual([staging]);

    await configureEnvironments(context);
    expect(store.has(SECRET_KEY)).toBe(false);
  });

  it('returns false and changes nothing when removal is cancelled', async () => {
    const { context, store } = createContext([prod, staging]);
    showQuickPick.mockResolvedValueOnce({ id: 'remove' }).mockResolvedValueOnce(undefined);

    await expect(configureEnvironments(context)).resolves.toBe(false);
    expect(storedConfigs(store)).toEqual([prod, staging]);
  });

  it('clears all environments', async () => {
    const { context, store } = createContext([prod, staging]);
    showQuickPick.mockResolvedValueOnce({ id: 'clear' });

    await expect(configureEnvironments(context)).resolves.toBe(true);
    expect(store.has(SECRET_KEY)).toBe(false);
  });
});
