export class EventEmitter<T> {
  private readonly listeners: Array<(value: T) => void> = [];

  readonly event = (listener: (value: T) => void) => {
    this.listeners.push(listener);
    return { dispose: jest.fn() };
  };

  fire(value: T): void {
    this.listeners.forEach((listener) => listener(value));
  }

  dispose = jest.fn();
}

export class McpStdioServerDefinition {
  constructor(
    public label: string,
    public command: string,
    public args: string[],
    public env: Record<string, string | number | null>,
    public version?: string,
  ) {}
}

export const Uri = {
  joinPath: (base: { fsPath: string }, ...segments: string[]) => ({
    fsPath: [base.fsPath, ...segments].join('/'),
  }),
};

export const window = {
  showInputBox: jest.fn(),
  showQuickPick: jest.fn(),
  showInformationMessage: jest.fn(),
};

export const workspace = {
  getConfiguration: jest.fn(),
  onDidChangeConfiguration: jest.fn(),
};

export const commands = {
  registerCommand: jest.fn(),
};

export const lm = {
  registerMcpServerDefinitionProvider: jest.fn(),
};
