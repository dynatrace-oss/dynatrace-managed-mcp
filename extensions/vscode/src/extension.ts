import * as vscode from 'vscode';
import { clearEnvironmentConfigs, configureEnvironments, ensureEnvironmentConfigs } from './config';

const PROVIDER_ID = 'dynatrace-managed';

const SERVER_MODULE = ['dist', 'mcp', 'server.js'];

const SERVER_LABEL = 'Dynatrace Managed';

interface ServerPackageSpec {
  npmPackage: string;
  npmVersionRange: string;
}

type ServerEnvironment = Record<string, string | number | null>;

function settings(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('dynatraceManagedMcp');
}

function buildEnvironment(): ServerEnvironment {
  const config = settings();

  const env: ServerEnvironment = {
    LOG_OUTPUT: 'stderr-all',
    LOG_LEVEL: config.get<string>('logLevel', 'info'),
    DT_MCP_ENABLE_TELEMETRY: String(config.get<boolean>('enableTelemetry', false)),
    DT_MCP_RATE_LIMIT_MAX_CALLS: String(config.get<number>('rateLimit.maxCalls', 20)),
    DT_MCP_RATE_LIMIT_WINDOW_MS: String(config.get<number>('rateLimit.windowMs', 20000)),
  };

  const vscodeProxy = vscode.workspace.getConfiguration('http').get<string>('proxy', '');
  const httpProxy = config.get<string>('httpProxy', '') || vscodeProxy;
  const httpsProxy = config.get<string>('httpsProxy', '') || vscodeProxy;

  if (httpProxy) {
    env.HTTP_PROXY = httpProxy;
  }
  if (httpsProxy) {
    env.HTTPS_PROXY = httpsProxy;
  }

  return env;
}

function bundledServerDefinition(context: vscode.ExtensionContext): vscode.McpStdioServerDefinition {
  const serverPath = vscode.Uri.joinPath(context.extensionUri, ...SERVER_MODULE).fsPath;

  return new vscode.McpStdioServerDefinition(
    SERVER_LABEL,
    process.execPath,
    [serverPath],
    { ...buildEnvironment(), ELECTRON_RUN_AS_NODE: '1' },
    context.extension.packageJSON.version,
  );
}

function npxServerDefinition(context: vscode.ExtensionContext): vscode.McpStdioServerDefinition {
  const spec = context.extension.packageJSON.dynatraceManagedMcpServer as ServerPackageSpec;

  return new vscode.McpStdioServerDefinition(
    SERVER_LABEL,
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['-y', `${spec.npmPackage}@${spec.npmVersionRange}`],
    buildEnvironment(),
    context.extension.packageJSON.version,
  );
}

export function activate(context: vscode.ExtensionContext): void {
  const didChangeDefinitions = new vscode.EventEmitter<void>();
  context.subscriptions.push(didChangeDefinitions);

  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, {
      onDidChangeMcpServerDefinitions: didChangeDefinitions.event,

      provideMcpServerDefinitions: async () => {
        const runtime = settings().get<string>('runtime', 'bundled');
        return [runtime === 'npx' ? npxServerDefinition(context) : bundledServerDefinition(context)];
      },

      resolveMcpServerDefinition: async (server) => {
        const environmentConfigs = await ensureEnvironmentConfigs(context);
        if (environmentConfigs === undefined) {
          return undefined;
        }

        if (server instanceof vscode.McpStdioServerDefinition) {
          server.env.DT_ENVIRONMENT_CONFIGS = environmentConfigs;
        }

        return server;
      },
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dynatraceManagedMcp.configure', async () => {
      if (await configureEnvironments(context)) {
        didChangeDefinitions.fire();
      }
    }),

    vscode.commands.registerCommand('dynatraceManagedMcp.clearConfiguration', async () => {
      await clearEnvironmentConfigs(context);
      didChangeDefinitions.fire();
      void vscode.window.showInformationMessage('Stored Dynatrace Managed cluster configuration cleared.');
    }),

    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('dynatraceManagedMcp') || event.affectsConfiguration('http.proxy')) {
        didChangeDefinitions.fire();
      }
    }),
  );
}
