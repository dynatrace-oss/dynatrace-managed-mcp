import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigFileLoader } from '../config-loader';

// Mock logger to avoid console output during tests
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ConfigFileLoader', () => {
  let testDir: string;

  beforeEach(() => {
    // Create temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-loader-test-'));
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Clear environment variables
    delete process.env.TEST_TOKEN;
    delete process.env.TEST_URL;
  });

  describe('JSON file loading', () => {
    it('should load valid JSON configuration file', () => {
      const configPath = path.join(testDir, 'config.json');
      const config = [
        {
          apiEndpointUrl: 'https://api.example.com/',
          environmentId: 'test-123',
          alias: 'production',
          apiToken: 'dt0c01.ABC123',
        },
      ];

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = ConfigFileLoader.loadFromFile(configPath);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        apiEndpointUrl: 'https://api.example.com/',
        environmentId: 'test-123',
        alias: 'production',
        apiToken: 'dt0c01.ABC123',
      });
    });

    it('should load multiple environments from JSON', () => {
      const configPath = path.join(testDir, 'config.json');
      const config = [
        {
          apiEndpointUrl: 'https://api-prod.example.com/',
          environmentId: 'prod-123',
          alias: 'production',
          apiToken: 'prod-token',
        },
        {
          apiEndpointUrl: 'https://api-staging.example.com/',
          environmentId: 'staging-456',
          alias: 'staging',
          apiToken: 'staging-token',
        },
      ];

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = ConfigFileLoader.loadFromFile(configPath);

      expect(result).toHaveLength(2);
      expect(result[0].alias).toBe('production');
      expect(result[1].alias).toBe('staging');
    });

    it('should throw error for invalid JSON syntax', () => {
      const configPath = path.join(testDir, 'invalid.json');
      fs.writeFileSync(configPath, '{ invalid json }');

      expect(() => ConfigFileLoader.loadFromFile(configPath)).toThrow(/Failed to parse \.json file/);
    });
  });

  describe('YAML file loading', () => {
    it('should load valid YAML configuration file (.yaml)', () => {
      const configPath = path.join(testDir, 'config.yaml');
      const yamlContent = `
- apiEndpointUrl: https://api.example.com/
  environmentId: test-123
  alias: production
  apiToken: dt0c01.ABC123
`;

      fs.writeFileSync(configPath, yamlContent);

      const result = ConfigFileLoader.loadFromFile(configPath);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        apiEndpointUrl: 'https://api.example.com/',
        environmentId: 'test-123',
        alias: 'production',
        apiToken: 'dt0c01.ABC123',
      });
    });

    it('should load valid YAML configuration file (.yml)', () => {
      const configPath = path.join(testDir, 'config.yml');
      const yamlContent = `
- apiEndpointUrl: https://api.example.com/
  environmentId: test-123
  alias: production
  apiToken: dt0c01.ABC123
`;

      fs.writeFileSync(configPath, yamlContent);

      const result = ConfigFileLoader.loadFromFile(configPath);

      expect(result).toHaveLength(1);
      expect(result[0].alias).toBe('production');
    });

    it('should handle YAML with comments', () => {
      const configPath = path.join(testDir, 'config.yaml');
      const yamlContent = `
# Production environment
- apiEndpointUrl: https://api.example.com/ # API URL
  environmentId: test-123
  alias: production # Environment alias
  apiToken: dt0c01.ABC123
`;

      fs.writeFileSync(configPath, yamlContent);

      const result = ConfigFileLoader.loadFromFile(configPath);

      expect(result).toHaveLength(1);
      expect(result[0].alias).toBe('production');
    });

    it('should throw error for invalid YAML syntax', () => {
      const configPath = path.join(testDir, 'invalid.yaml');
      fs.writeFileSync(configPath, 'key: value:\n  invalid: yaml:');

      expect(() => ConfigFileLoader.loadFromFile(configPath)).toThrow(/Failed to parse \.yaml file/);
    });
  });

  describe('Environment variable interpolation', () => {
    it('should interpolate environment variables in JSON', () => {
      process.env.TEST_TOKEN = 'my-secret-token';

      const configPath = path.join(testDir, 'config.json');
      const config = [
        {
          apiEndpointUrl: 'https://api.example.com/',
          environmentId: 'test-123',
          alias: 'production',
          apiToken: '${TEST_TOKEN}',
        },
      ];

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = ConfigFileLoader.loadFromFile(configPath);

      expect(result[0].apiToken).toBe('my-secret-token');
    });

    it('should interpolate environment variables in YAML', () => {
      process.env.TEST_TOKEN = 'my-secret-token';
      process.env.TEST_URL = 'https://api.example.com/';

      const configPath = path.join(testDir, 'config.yaml');
      const yamlContent = `
- apiEndpointUrl: \${TEST_URL}
  environmentId: test-123
  alias: production
  apiToken: \${TEST_TOKEN}
`;

      fs.writeFileSync(configPath, yamlContent);

      const result = ConfigFileLoader.loadFromFile(configPath);

      expect(result[0].apiToken).toBe('my-secret-token');
      expect(result[0].apiEndpointUrl).toBe('https://api.example.com/');
    });

    it('should interpolate multiple environment variables', () => {
      process.env.PROD_TOKEN = 'prod-token';
      process.env.STAGING_TOKEN = 'staging-token';

      const configPath = path.join(testDir, 'config.json');
      const config = [
        {
          apiEndpointUrl: 'https://prod.example.com/',
          environmentId: 'prod',
          alias: 'production',
          apiToken: '${PROD_TOKEN}',
        },
        {
          apiEndpointUrl: 'https://staging.example.com/',
          environmentId: 'staging',
          alias: 'staging',
          apiToken: '${STAGING_TOKEN}',
        },
      ];

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = ConfigFileLoader.loadFromFile(configPath);

      expect(result[0].apiToken).toBe('prod-token');
      expect(result[1].apiToken).toBe('staging-token');
    });

    it('should throw error when environment variable is not found', () => {
      const configPath = path.join(testDir, 'config.json');
      const config = [
        {
          apiEndpointUrl: 'https://api.example.com/',
          environmentId: 'test-123',
          alias: 'production',
          apiToken: '${NONEXISTENT_TOKEN}',
        },
      ];

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      expect(() => ConfigFileLoader.loadFromFile(configPath)).toThrow(
        /Environment variable not found: NONEXISTENT_TOKEN/,
      );
    });
  });

  describe('Path resolution', () => {
    it('should resolve relative paths', () => {
      const configPath = './test-config.json';
      const absolutePath = path.resolve(process.cwd(), configPath);
      const config = [
        {
          apiEndpointUrl: 'https://api.example.com/',
          environmentId: 'test-123',
          alias: 'production',
          apiToken: 'token',
        },
      ];

      fs.writeFileSync(absolutePath, JSON.stringify(config, null, 2));

      try {
        const result = ConfigFileLoader.loadFromFile(configPath);
        expect(result).toHaveLength(1);
      } finally {
        fs.unlinkSync(absolutePath);
      }
    });

    it('should resolve absolute paths', () => {
      const configPath = path.join(testDir, 'config.json');
      const config = [
        {
          apiEndpointUrl: 'https://api.example.com/',
          environmentId: 'test-123',
          alias: 'production',
          apiToken: 'token',
        },
      ];

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = ConfigFileLoader.loadFromFile(configPath);
      expect(result).toHaveLength(1);
    });

    it('should expand ~ to home directory', () => {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      if (!homeDir) {
        // Skip test if home directory cannot be determined
        return;
      }

      const configFileName = '.test-dt-config.json';
      const configPath = path.join(homeDir, configFileName);
      const config = [
        {
          apiEndpointUrl: 'https://api.example.com/',
          environmentId: 'test-123',
          alias: 'production',
          apiToken: 'token',
        },
      ];

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      try {
        const result = ConfigFileLoader.loadFromFile(`~/${configFileName}`);
        expect(result).toHaveLength(1);
      } finally {
        fs.unlinkSync(configPath);
      }
    });

    it('should throw error for non-existent file', () => {
      const configPath = path.join(testDir, 'nonexistent.json');

      expect(() => ConfigFileLoader.loadFromFile(configPath)).toThrow(/Configuration file not found/);
    });
  });

  describe('Configuration validation', () => {
    it('should throw error if configuration is not an array', () => {
      const configPath = path.join(testDir, 'config.json');
      const config = {
        apiEndpointUrl: 'https://api.example.com/',
        environmentId: 'test-123',
        alias: 'production',
        apiToken: 'token',
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      expect(() => ConfigFileLoader.loadFromFile(configPath)).toThrow(/Configuration must be an array/);
    });

    it('should throw error for missing apiEndpointUrl', () => {
      const configPath = path.join(testDir, 'config.json');
      const config = [
        {
          environmentId: 'test-123',
          alias: 'production',
          apiToken: 'token',
        },
      ];

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      expect(() => ConfigFileLoader.loadFromFile(configPath)).toThrow(
        /Environment #1.*missing required fields.*apiEndpointUrl/,
      );
    });

    it('should throw error for missing environmentId', () => {
      const configPath = path.join(testDir, 'config.json');
      const config = [
        {
          apiEndpointUrl: 'https://api.example.com/',
          alias: 'production',
          apiToken: 'token',
        },
      ];

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      expect(() => ConfigFileLoader.loadFromFile(configPath)).toThrow(
        /Environment #1.*missing required fields.*environmentId/,
      );
    });

    it('should throw error for missing alias', () => {
      const configPath = path.join(testDir, 'config.json');
      const config = [
        {
          apiEndpointUrl: 'https://api.example.com/',
          environmentId: 'test-123',
          apiToken: 'token',
        },
      ];

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      expect(() => ConfigFileLoader.loadFromFile(configPath)).toThrow(/Environment #1.*missing required fields.*alias/);
    });

    it('should throw error for missing apiToken', () => {
      const configPath = path.join(testDir, 'config.json');
      const config = [
        {
          apiEndpointUrl: 'https://api.example.com/',
          environmentId: 'test-123',
          alias: 'production',
        },
      ];

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      expect(() => ConfigFileLoader.loadFromFile(configPath)).toThrow(
        /Environment #1.*missing required fields.*apiToken/,
      );
    });

    it('should accept optional fields', () => {
      const configPath = path.join(testDir, 'config.json');
      const config = [
        {
          apiEndpointUrl: 'https://api.example.com/',
          environmentId: 'test-123',
          alias: 'production',
          apiToken: 'token',
          dynatraceUrl: 'https://dashboard.example.com/',
          httpProxyUrl: 'http://proxy.example.com:8080',
        },
      ];

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const result = ConfigFileLoader.loadFromFile(configPath);

      expect(result[0]).toMatchObject({
        dynatraceUrl: 'https://dashboard.example.com/',
        httpProxyUrl: 'http://proxy.example.com:8080',
      });
    });
  });

  describe('Unsupported file formats', () => {
    it('should throw error for unsupported file extension', () => {
      const configPath = path.join(testDir, 'config.txt');
      fs.writeFileSync(configPath, 'some content');

      expect(() => ConfigFileLoader.loadFromFile(configPath)).toThrow(/Unsupported file format: \.txt/);
    });
  });
});
