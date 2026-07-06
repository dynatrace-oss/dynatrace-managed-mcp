/**
 * Integration tests specifically for sorting parameters across all API clients
 */

import { EntitiesApiClient } from '../../src/capabilities/entities-api';
import { ProblemsApiClient } from '../../src/capabilities/problems-api';
import { SecurityApiClient } from '../../src/capabilities/security-api';
import { SloApiClient } from '../../src/capabilities/slo-api';
import { LogsApiClient } from '../../src/capabilities/logs-api';
import { ManagedAuthClientManager, buildManagedAuthClients } from '../../src/authentication/managed-auth-client';
import { getManagedEnvironmentConfigs, validateEnvironments, buildConfigTokenMap } from '../../src/utils/environment';
import { config } from 'dotenv';

// Load environment variables
config();

let skip = false;
if (!process.env.DT_ENVIRONMENT_CONFIGS) {
  console.log('Skipping integration tests - environment not configured');
  skip = true;
}

(skip ? describe.skip : describe)('Sorting Parameters Integration Tests', () => {
  let logsClient: LogsApiClient;
  let entitiesClient: EntitiesApiClient;
  let problemsClient: ProblemsApiClient;
  let securityClient: SecurityApiClient;
  let sloClient: SloApiClient;

  beforeAll(() => {
    const config = getManagedEnvironmentConfigs();
    const validEnvironments = validateEnvironments(config);
    const validConfigs = validEnvironments['valid_configs'];

    const allClients = buildManagedAuthClients(validConfigs);
    const tokens = buildConfigTokenMap(validConfigs);
    const validAliases = ['ALL_ENVIRONMENTS', ...allClients.map((c) => c.alias)];
    const authManager = new ManagedAuthClientManager(allClients, allClients, validAliases, tokens);

    logsClient = new LogsApiClient(authManager);
    entitiesClient = new EntitiesApiClient(authManager);
    problemsClient = new ProblemsApiClient(authManager);
    securityClient = new SecurityApiClient(authManager);
    sloClient = new SloApiClient(authManager);
  });
  describe('Entities API Sorting', () => {
    it('should accept ascending sort parameter', async () => {
      await expect(
        entitiesClient.queryEntities(
          {
            entitySelector: 'type(HOST)',
            pageSize: 5,
            sort: '+name',
          },
          'testAlias',
        ),
      ).resolves.not.toThrow();
    });

    it('should accept descending sort parameter', async () => {
      await expect(
        entitiesClient.queryEntities(
          {
            entitySelector: 'type(SERVICE)',
            pageSize: 5,
            sort: '-name',
          },
          'testAlias',
        ),
      ).resolves.not.toThrow();
    });

    it('should work without sort parameter (backward compatibility)', async () => {
      await expect(
        entitiesClient.queryEntities(
          {
            entitySelector: 'type(HOST)',
            pageSize: 5,
          },
          'testAlias',
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('Problems API Sorting', () => {
    it('should accept ascending sort parameter', async () => {
      await expect(
        problemsClient.listProblems({ sort: '+startTime', pageSize: 5 }, 'testAlias'),
      ).resolves.not.toThrow();
    });

    it('should accept descending sort parameter', async () => {
      await expect(
        problemsClient.listProblems({ sort: '-startTime', pageSize: 5 }, 'testAlias'),
      ).resolves.not.toThrow();
    });

    it('should work without sort parameter (backward compatibility)', async () => {
      await expect(problemsClient.listProblems({ pageSize: 5 }, 'testAlias')).resolves.not.toThrow();
    });
  });

  describe('Security API Sorting', () => {
    it('should accept ascending sort parameter', async () => {
      await expect(
        securityClient.listSecurityProblems({ sort: '+riskAssessment.riskScore' }, 'testAlias'),
      ).resolves.not.toThrow();
    });

    it('should accept descending sort parameter', async () => {
      await expect(
        securityClient.listSecurityProblems({ sort: '-riskAssessment.riskScore' }, 'testAlias'),
      ).resolves.not.toThrow();
    });

    it('should work without sort parameter (backward compatibility)', async () => {
      await expect(securityClient.listSecurityProblems(undefined, 'testAlias')).resolves.not.toThrow();
    });
  });

  describe('SLO API Sorting', () => {
    it('should accept ascending sort parameter', async () => {
      await expect(sloClient.listSlos({ sort: 'name', pageSize: 5 }, 'testAlias')).resolves.not.toThrow();
    });

    it('should accept descending sort parameter', async () => {
      await expect(sloClient.listSlos({ sort: '-name', pageSize: 5 }, 'testAlias')).resolves.not.toThrow();
    });

    it('should work without sort parameter (backward compatibility)', async () => {
      await expect(sloClient.listSlos({ pageSize: 5 }, 'testAlias')).resolves.not.toThrow();
    });

    it('should accept evaluate parameter', async () => {
      await expect(sloClient.listSlos({ evaluate: true, pageSize: 5 }, 'testAlias')).resolves.not.toThrow();
    });

    it('should accept enabledSlos parameter', async () => {
      await expect(sloClient.listSlos({ enabledSlos: 'true', pageSize: 5 }, 'testAlias')).resolves.not.toThrow();
    });

    it('should accept showGlobalSlos parameter', async () => {
      await expect(sloClient.listSlos({ showGlobalSlos: false, pageSize: 5 }, 'testAlias')).resolves.not.toThrow();
    });
  });

  describe('Logs Sorting', () => {
    it('should accept ascending sort parameter', async () => {
      await expect(
        logsClient.queryLogs({ sort: '+timestamp', query: 'error', from: 'now-1h', to: 'now', limit: 5 }, 'testAlias'),
      ).resolves.not.toThrow();
    });

    it('should accept descending sort parameter', async () => {
      await expect(
        logsClient.queryLogs({ sort: '-timestamp', query: 'error', from: 'now-1h', to: 'now', limit: 5 }, 'testAlias'),
      ).resolves.not.toThrow();
    });

    it('should work without sort parameter (backward compatibility)', async () => {
      await expect(
        logsClient.queryLogs({ query: 'error', from: 'now-1h', to: 'now', limit: 5 }, 'testAlias'),
      ).resolves.not.toThrow();
    });
  });
});
