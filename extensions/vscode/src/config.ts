import * as vscode from 'vscode';

export interface ManagedEnvironmentConfig {
  apiEndpointUrl: string;
  environmentId: string;
  alias: string;
  apiToken: string;
}

const SECRET_KEY = 'dynatraceManagedMcp.environmentConfigs';

export async function readEnvironmentConfigs(
  context: vscode.ExtensionContext,
): Promise<ManagedEnvironmentConfig[] | undefined> {
  const stored = await context.secrets.get(SECRET_KEY);
  if (!stored) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as ManagedEnvironmentConfig[]) : undefined;
  } catch {
    return undefined;
  }
}

async function writeEnvironmentConfigs(
  context: vscode.ExtensionContext,
  configs: ManagedEnvironmentConfig[],
): Promise<void> {
  if (configs.length === 0) {
    await context.secrets.delete(SECRET_KEY);
    return;
  }

  await context.secrets.store(SECRET_KEY, JSON.stringify(configs));
}

export async function clearEnvironmentConfigs(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_KEY);
}

function validateApiEndpointUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'The cluster URL is required.';
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'Enter an absolute URL, for example https://managed.example.com';
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return 'The cluster URL must use http or https.';
  }

  return undefined;
}

function validateAlias(value: string, existing: readonly ManagedEnvironmentConfig[]): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'An alias is required - it is how you refer to this cluster when asking questions.';
  }

  // The server rejects semicolons because aliases are joined into a single delimited string.
  if (trimmed.includes(';')) {
    return 'Aliases cannot contain semicolons.';
  }

  if (existing.some((config) => config.alias === trimmed)) {
    return `An environment with the alias "${trimmed}" is already configured.`;
  }

  return undefined;
}

function validateRequired(value: string, label: string): string | undefined {
  return value.trim().length === 0 ? `${label} is required.` : undefined;
}

async function promptForEnvironment(
  existing: readonly ManagedEnvironmentConfig[],
): Promise<ManagedEnvironmentConfig | undefined> {
  const apiEndpointUrl = await vscode.window.showInputBox({
    title: 'Add a Dynatrace Managed cluster (1 of 4)',
    prompt: 'Cluster URL',
    placeHolder: 'https://managed.example.com',
    ignoreFocusOut: true,
    validateInput: validateApiEndpointUrl,
  });
  if (apiEndpointUrl === undefined) {
    return undefined;
  }

  const environmentId = await vscode.window.showInputBox({
    title: 'Add a Dynatrace Managed cluster (2 of 4)',
    prompt: 'Environment ID',
    placeHolder: 'abc12345',
    ignoreFocusOut: true,
    validateInput: (value) => validateRequired(value, 'The environment ID'),
  });
  if (environmentId === undefined) {
    return undefined;
  }

  const alias = await vscode.window.showInputBox({
    title: 'Add a Dynatrace Managed cluster (3 of 4)',
    prompt: 'Alias - a short name you will use to refer to this environment',
    placeHolder: 'prod',
    ignoreFocusOut: true,
    validateInput: (value) => validateAlias(value, existing),
  });
  if (alias === undefined) {
    return undefined;
  }

  const apiToken = await vscode.window.showInputBox({
    title: 'Add a Dynatrace Managed cluster (4 of 4)',
    prompt: 'API token - stored in the OS keychain, never in settings.json',
    placeHolder: 'dt0c01....',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => validateRequired(value, 'The API token'),
  });
  if (apiToken === undefined) {
    return undefined;
  }

  return {
    apiEndpointUrl: apiEndpointUrl.trim(),
    environmentId: environmentId.trim(),
    alias: alias.trim(),
    apiToken: apiToken.trim(),
  };
}

async function removeEnvironment(
  context: vscode.ExtensionContext,
  configs: ManagedEnvironmentConfig[],
): Promise<boolean> {
  const picked = await vscode.window.showQuickPick(
    configs.map((config) => ({ label: config.alias, description: config.apiEndpointUrl })),
    { title: 'Remove a Dynatrace Managed cluster', ignoreFocusOut: true },
  );
  if (!picked) {
    return false;
  }

  await writeEnvironmentConfigs(
    context,
    configs.filter((config) => config.alias !== picked.label),
  );
  return true;
}

export async function configureEnvironments(context: vscode.ExtensionContext): Promise<boolean> {
  const configs = (await readEnvironmentConfigs(context)) ?? [];

  if (configs.length === 0) {
    const added = await promptForEnvironment(configs);
    if (!added) {
      return false;
    }

    await writeEnvironmentConfigs(context, [added]);
    void vscode.window.showInformationMessage(`Dynatrace Managed cluster "${added.alias}" configured.`);
    return true;
  }

  const aliases = configs.map((config) => config.alias).join(', ');
  const action = await vscode.window.showQuickPick(
    [
      { label: 'Add a cluster', id: 'add' as const },
      { label: 'Remove a cluster', id: 'remove' as const },
      { label: 'Clear all clusters', id: 'clear' as const },
    ],
    {
      title: `Dynatrace Managed MCP - ${configs.length} cluster(s) configured: ${aliases}`,
      ignoreFocusOut: true,
    },
  );
  if (!action) {
    return false;
  }

  if (action.id === 'add') {
    const added = await promptForEnvironment(configs);
    if (!added) {
      return false;
    }

    await writeEnvironmentConfigs(context, [...configs, added]);
    void vscode.window.showInformationMessage(`Dynatrace Managed cluster "${added.alias}" configured.`);
    return true;
  }

  if (action.id === 'remove') {
    return removeEnvironment(context, configs);
  }

  await clearEnvironmentConfigs(context);
  void vscode.window.showInformationMessage('Stored Dynatrace Managed cluster configuration cleared.');
  return true;
}

export async function ensureEnvironmentConfigs(context: vscode.ExtensionContext): Promise<string | undefined> {
  const configs = await readEnvironmentConfigs(context);
  if (configs && configs.length > 0) {
    return JSON.stringify(configs);
  }

  const added = await promptForEnvironment([]);
  if (!added) {
    return undefined;
  }

  await writeEnvironmentConfigs(context, [added]);
  return JSON.stringify([added]);
}
