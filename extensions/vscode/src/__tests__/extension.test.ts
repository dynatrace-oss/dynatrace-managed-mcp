import * as vscode from 'vscode';
import manifest from '../../package.json';
import { activate } from '../extension';

const EXTENSION_ROOT = '/extension';
const STORED_CONFIGS = JSON.stringify([
  { apiEndpointUrl: 'https://prod.example.com', environmentId: 'prod-env', alias: 'prod', apiToken: 'dt0c01.PROD' },
]);
const token = {} as vscode.CancellationToken;

const registerProvider = vscode.lm.registerMcpServerDefinitionProvider as jest.Mock;
const registerCommand = vscode.commands.registerCommand as jest.Mock;
const getConfiguration = vscode.workspace.getConfiguration as jest.Mock;
const onDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration as jest.Mock;
const showInputBox = vscode.window.showInputBox as jest.Mock;

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;

let settings: Record<string, Record<string, unknown>>;
let secret: string | undefined;
let context: vscode.ExtensionContext;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform });
}

function provider(): vscode.McpServerDefinitionProvider<vscode.McpStdioServerDefinition> {
  return registerProvider.mock.calls[0][1];
}

async function provideDefinition(): Promise<vscode.McpStdioServerDefinition> {
  const definitions = await provider().provideMcpServerDefinitions(token);
  return definitions![0];
}

function command(id: string): () => Promise<void> {
  return registerCommand.mock.calls.find(([name]) => name === id)[1];
}

function changeSetting(section: string): void {
  const listener = onDidChangeConfiguration.mock.calls[0][0];
  listener({ affectsConfiguration: (affected: string) => affected === section });
}

function watchDefinitionChanges(): jest.Mock {
  const listener = jest.fn();
  provider().onDidChangeMcpServerDefinitions!(listener);
  return listener;
}

beforeEach(() => {
  jest.resetAllMocks();
  settings = {};
  secret = STORED_CONFIGS;

  getConfiguration.mockImplementation((section: string) => ({
    get: (key: string, defaultValue?: unknown) => settings[section]?.[key] ?? defaultValue,
  }));

  context = {
    subscriptions: [],
    extensionUri: { fsPath: EXTENSION_ROOT },
    extension: { packageJSON: manifest },
    secrets: {
      get: jest.fn(async () => secret),
      store: jest.fn(async (_key: string, value: string) => {
        secret = value;
      }),
      delete: jest.fn(async () => {
        secret = undefined;
      }),
    },
  } as unknown as vscode.ExtensionContext;

  activate(context);
});

afterEach(() => {
  Object.defineProperty(process, 'platform', originalPlatform);
});

describe('activate', () => {
  it('registers the provider under the id contributed in package.json', () => {
    expect(registerProvider).toHaveBeenCalledWith(
      manifest.contributes.mcpServerDefinitionProviders[0].id,
      expect.any(Object),
    );
  });

  it('registers every command contributed in package.json', () => {
    const registered = registerCommand.mock.calls.map(([id]) => id).sort();
    const contributed = manifest.contributes.commands.map(({ command: id }) => id).sort();

    expect(registered).toEqual(contributed);
  });
});

describe('server definition', () => {
  it('runs the bundled server on the Node.js runtime inside VS Code by default', async () => {
    const definition = await provideDefinition();

    expect(definition.command).toBe(process.execPath);
    expect(definition.args).toEqual([`${EXTENSION_ROOT}/dist/mcp/server.js`]);
    expect(definition.env.ELECTRON_RUN_AS_NODE).toBe('1');
    expect(definition.env.LOG_OUTPUT).toBe('stderr-all');
    expect(definition.version).toBe(manifest.version);
  });

  it('maps the extension settings onto the server environment', async () => {
    settings.dynatraceManagedMcp = {
      'logLevel': 'debug',
      'enableTelemetry': true,
      'rateLimit.maxCalls': 5,
      'rateLimit.windowMs': 1000,
    };

    const definition = await provideDefinition();

    expect(definition.env).toMatchObject({
      LOG_LEVEL: 'debug',
      DT_MCP_ENABLE_TELEMETRY: 'true',
      DT_MCP_RATE_LIMIT_MAX_CALLS: '5',
      DT_MCP_RATE_LIMIT_WINDOW_MS: '1000',
    });
  });

  it('never puts the API tokens in the definition VS Code may cache', async () => {
    const definition = await provideDefinition();

    expect(definition.env).not.toHaveProperty('DT_ENVIRONMENT_CONFIGS');
  });

  it.each<[NodeJS.Platform, string]>([
    ['linux', 'npx'],
    ['win32', 'npx.cmd'],
  ])('launches the published package with npx on %s', async (platform, expectedCommand) => {
    setPlatform(platform);
    settings.dynatraceManagedMcp = { runtime: 'npx' };

    const definition = await provideDefinition();

    const { npmPackage, npmVersionRange } = manifest.dynatraceManagedMcpServer;
    expect(definition.command).toBe(expectedCommand);
    expect(definition.args).toEqual(['-y', `${npmPackage}@${npmVersionRange}`]);
    expect(definition.env).not.toHaveProperty('ELECTRON_RUN_AS_NODE');
  });

  it('prefers the extension proxy settings over the VS Code one', async () => {
    settings.http = { proxy: 'http://vscode-proxy:8080' };
    settings.dynatraceManagedMcp = { httpProxy: 'http://plain:8080', httpsProxy: 'http://secure:8443' };

    const definition = await provideDefinition();

    expect(definition.env.HTTP_PROXY).toBe('http://plain:8080');
    expect(definition.env.HTTPS_PROXY).toBe('http://secure:8443');
  });

  it('falls back to the VS Code http.proxy setting', async () => {
    settings.http = { proxy: 'http://vscode-proxy:8080' };

    const definition = await provideDefinition();

    expect(definition.env.HTTP_PROXY).toBe('http://vscode-proxy:8080');
    expect(definition.env.HTTPS_PROXY).toBe('http://vscode-proxy:8080');
  });
});

describe('resolveMcpServerDefinition', () => {
  it('adds the stored environments right before the server starts', async () => {
    const resolved = await provider().resolveMcpServerDefinition!(await provideDefinition(), token);

    expect(resolved?.env.DT_ENVIRONMENT_CONFIGS).toBe(STORED_CONFIGS);
  });

  it('cancels the start when the user dismisses the configuration prompt', async () => {
    secret = undefined;
    showInputBox.mockResolvedValueOnce(undefined);

    const resolved = await provider().resolveMcpServerDefinition!(await provideDefinition(), token);

    expect(resolved).toBeUndefined();
  });
});

describe('definition change notifications', () => {
  it.each<[string, number]>([
    ['dynatraceManagedMcp', 1],
    ['http.proxy', 1],
    ['editor.fontSize', 0],
  ])('a change to %s fires %i time(s)', (section, expectedCalls) => {
    const listener = watchDefinitionChanges();

    changeSetting(section);

    expect(listener).toHaveBeenCalledTimes(expectedCalls);
  });

  it('fires when the configure command changes the stored environments', async () => {
    secret = undefined;
    ['https://prod.example.com', 'prod-env', 'prod', 'dt0c01.PROD'].forEach((answer) =>
      showInputBox.mockResolvedValueOnce(answer),
    );
    const listener = watchDefinitionChanges();

    await command('dynatraceManagedMcp.configure')();

    expect(listener).toHaveBeenCalled();
  });

  it('does not fire when the configure command is cancelled', async () => {
    secret = undefined;
    showInputBox.mockResolvedValueOnce(undefined);
    const listener = watchDefinitionChanges();

    await command('dynatraceManagedMcp.configure')();

    expect(listener).not.toHaveBeenCalled();
  });

  it('deletes the stored environments and fires when the clear command runs', async () => {
    const listener = watchDefinitionChanges();

    await command('dynatraceManagedMcp.clearConfiguration')();

    expect(secret).toBeUndefined();
    expect(listener).toHaveBeenCalled();
  });
});
