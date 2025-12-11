/**
 * Integration tests specifically for sorting parameters across all API clients
 */

import { EntitiesApiClient } from '../../src/capabilities/entities-api';
import { ProblemsApiClient } from '../../src/capabilities/problems-api';
import { SecurityApiClient } from '../../src/capabilities/security-api';
import { SloApiClient } from '../../src/capabilities/slo-api';
import { LogsApiClient } from '../../src/capabilities/logs-api';
import { ManagedAuthClient } from '../../src/authentication/managed-auth-client';
import { getManagedEnvironmentConfig } from '../../src/utils/environment';
import { config } from 'dotenv';

// Load environment variables
config();

let skip = false;
if (!process.env.DT_MANAGED_ENVIRONMENT || !process.env.DT_MANAGED_API_TOKEN) {
  console.log('Skipping integration tests - environment not configured');
  skip = true;
}

(skip ? describe.skip : describe)('Sorting Parameters Integration Tests', () => {
  let authClient: ManagedAuthClient;
  let entitiesClient: EntitiesApiClient;
  let problemsClient: ProblemsApiClient;
  let securityClient: SecurityApiClient;
  let sloClient: SloApiClient;
  let logsClient: LogsApiClient;

  beforeAll(() => {
    const config = getManagedEnvironmentConfig();
    authClient = new ManagedAuthClient(config.environment, config.apiToken);
    entitiesClient = new EntitiesApiClient(authClient);
    problemsClient = new ProblemsApiClient(authClient);
    securityClient = new SecurityApiClient(authClient);
    sloClient = new SloApiClient(authClient);
    logsClient = new LogsApiClient(authClient);
  });

  describe('Entities API Sorting', () => {
    it('should accept ascending sort parameter', async () => {
      await expect(
        entitiesClient.queryEntities({
          entitySelector: 'type(HOST)',
          pageSize: 5,
          sort: '+name',
        }),
      ).resolves.not.toThrow();
    });

    it('should accept descending sort parameter', async () => {
      await expect(
        entitiesClient.queryEntities({
          entitySelector: 'type(SERVICE)',
          pageSize: 5,
          sort: '-name',
        }),
      ).resolves.not.toThrow();
    });

    it('should work without sort parameter (backward compatibility)', async () => {
      await expect(
        entitiesClient.queryEntities({
          entitySelector: 'type(HOST)',
          pageSize: 5,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('Problems API Sorting', () => {
    it('should accept ascending sort parameter', async () => {
      await expect(problemsClient.listProblems({ sort: '+startTime', pageSize: 5 })).resolves.not.toThrow();
    });

    it('should accept descending sort parameter', async () => {
      await expect(problemsClient.listProblems({ sort: '-startTime', pageSize: 5 })).resolves.not.toThrow();
    });

    it('should work without sort parameter (backward compatibility)', async () => {
      await expect(problemsClient.listProblems({ pageSize: 5 })).resolves.not.toThrow();
    });
  });

  describe('Security API Sorting', () => {
    it('should accept ascending sort parameter', async () => {
      await expect(securityClient.listSecurityProblems({ sort: '+riskAssessment.riskScore' })).resolves.not.toThrow();
    });

    it('should accept descending sort parameter', async () => {
      await expect(securityClient.listSecurityProblems({ sort: '-riskAssessment.riskScore' })).resolves.not.toThrow();
    });

    it('should work without sort parameter (backward compatibility)', async () => {
      await expect(securityClient.listSecurityProblems()).resolves.not.toThrow();
    });
  });

  describe('SLO API Sorting', () => {
    it('should accept ascending sort parameter', async () => {
      await expect(sloClient.listSlos({ sort: 'name', pageSize: 5 })).resolves.not.toThrow();
    });

    it('should accept descending sort parameter', async () => {
      await expect(sloClient.listSlos({ sort: '-name', pageSize: 5 })).resolves.not.toThrow();
    });

    it('should work without sort parameter (backward compatibility)', async () => {
      await expect(sloClient.listSlos({ pageSize: 5 })).resolves.not.toThrow();
    });

    it('should accept evaluate parameter', async () => {
      await expect(sloClient.listSlos({ evaluate: true, pageSize: 5 })).resolves.not.toThrow();
    });

    it('should accept enabledSlos parameter', async () => {
      await expect(sloClient.listSlos({ enabledSlos: 'true', pageSize: 5 })).resolves.not.toThrow();
    });

    it('should accept showGlobalSlos parameter', async () => {
      await expect(sloClient.listSlos({ showGlobalSlos: false, pageSize: 5 })).resolves.not.toThrow();
    });
  });

  describe('Logs Sorting', () => {
    it('should accept ascending sort parameter', async () => {
      await expect(
        logsClient.queryLogs({ sort: '+timestamp', query: 'error', from: 'now-1h', to: 'now', limit: 5 }),
      ).resolves.not.toThrow();
    });

    it('should accept descending sort parameter', async () => {
      await expect(
        logsClient.queryLogs({ sort: '-timestamp', query: 'error', from: 'now-1h', to: 'now', limit: 5 }),
      ).resolves.not.toThrow();
    });

    it('should work without sort parameter (backward compatibility)', async () => {
      await expect(
        logsClient.queryLogs({ query: 'error', from: 'now-1h', to: 'now', limit: 5 }),
      ).resolves.not.toThrow();
    });
  });
});
