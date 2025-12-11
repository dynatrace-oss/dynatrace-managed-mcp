/*
 * Some of these tests assume that the test environment will be populated with enough data.
 * For example, have at least one host entity, reporting cpu usage metric data. Tests will fail
 * if this is not the case.
 *
 * Although we could guard this to only do assetions if we find an entity (e.g. in case someone's
 * environment does not have those resources), it would greatly weaken the assertion (e.g. if we
 * just failed to extract the right data and incorrectly got no matches).
 *
 * An exception to this is SLOs: it is common enough to not have any SLOs defined in an environment.
 * Therefore those tests do conditional assertions, based on finding at leaset one SLO.
 */
import { ManagedAuthClient } from '../../src/authentication/managed-auth-client';
import { getManagedEnvironmentConfig } from '../../src/utils/environment';
import { MetricsApiClient } from '../../src/capabilities/metrics-api';
import { LogsApiClient } from '../../src/capabilities/logs-api';
import { EventsApiClient } from '../../src/capabilities/events-api';
import { EntitiesApiClient } from '../../src/capabilities/entities-api';
import { ProblemsApiClient } from '../../src/capabilities/problems-api';
import { SecurityApiClient } from '../../src/capabilities/security-api';
import { SloApiClient } from '../../src/capabilities/slo-api';
import { config } from 'dotenv';
import { logger } from '../../src/utils/logger';

// Load environment variables
config();

let skip = false;
if (!process.env.DT_MANAGED_ENVIRONMENT || !process.env.DT_MANAGED_API_TOKEN) {
  console.log('Skipping integration tests - environment not configured');
  skip = true;
}

(skip ? describe.skip : describe)('Capabilities Integration Tests', () => {
  let authClient: ManagedAuthClient;
  let metricsClient: MetricsApiClient;
  let logsClient: LogsApiClient;
  let eventsClient: EventsApiClient;
  let entitiesClient: EntitiesApiClient;
  let problemsClient: ProblemsApiClient;
  let securityClient: SecurityApiClient;
  let sloClient: SloApiClient;

  beforeAll(() => {
    const config = getManagedEnvironmentConfig();
    authClient = new ManagedAuthClient(config.environment, config.apiToken);
    metricsClient = new MetricsApiClient(authClient);
    logsClient = new LogsApiClient(authClient);
    eventsClient = new EventsApiClient(authClient);
    entitiesClient = new EntitiesApiClient(authClient);
    problemsClient = new ProblemsApiClient(authClient);
    securityClient = new SecurityApiClient(authClient);
    sloClient = new SloApiClient(authClient);
  });

  describe('MetricsApiClient', () => {
    it('should search metrics', async () => {
      const response = await metricsClient.listAvailableMetrics({ text: 'latency', pageSize: 5 });
      const result = metricsClient.formatMetricList(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('metricId:');
      expect(result).toContain('latency');
    }, 30000);

    it('should get available metrics', async () => {
      const response = await metricsClient.listAvailableMetrics({ pageSize: 5 });
      const result = metricsClient.formatMetricList(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('metricId:');
    }, 30000);

    it('should query metrics data', async () => {
      const response = await metricsClient.queryMetrics({
        metricSelector: 'builtin:host.cpu.usage',
        from: 'now-1h',
        to: 'now',
      });
      const result = metricsClient.formatMetricData(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      expect(result).toContain('metricId: builtin:host.cpu.usage');
    }, 30000);

    it('should get metric details', async () => {
      const response = await metricsClient.getMetricDetails('builtin:host.cpu.usage');
      const result = metricsClient.formatMetricDetails(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      expect(result).toContain('\"metricId\":\"builtin:host.cpu.usage\"');
    }, 30000);

    it('should respect pageSize', async () => {
      // Assumes there are at least 3 metrics (2 in the first page; and more in subsequent pages)
      const response = await metricsClient.listAvailableMetrics({ pageSize: 2 });
      let totalCount = response.totalCount || -1;
      let numMetrics = response.metrics?.length || 0;
      let nextPageKey = response.nextPageKey;
      let firstMetricId = response.metrics && numMetrics > 0 ? response.metrics[0].metricId : undefined;

      expect(numMetrics).toEqual(2);
      expect(totalCount > numMetrics);
      expect(nextPageKey).toBeDefined();
      expect(firstMetricId).toBeDefined();
    }, 30000);

    it('should support field selection in metrics listing', async () => {
      const response = await metricsClient.listAvailableMetrics({
        fields: 'metricId,displayName',
        pageSize: 5,
      });
      const result = metricsClient.formatMetricList(response);

      expect(result).toContain('metricId:');
      expect(result).toContain('displayName:');
    }, 30000);

    it('should support metadata selector filtering', async () => {
      const result = await metricsClient.listAvailableMetrics({
        metadataSelector: 'unit("Percent")',
        pageSize: 5,
      });

      expect(result.metrics?.length).toBeGreaterThan(0);
      result.metrics?.forEach((metric: any) => {
        expect(metric.unit).toEqual('Percent');
      });
    }, 30000);

    it('should handle metric query with entity selector', async () => {
      const response = await metricsClient.queryMetrics({
        metricSelector: 'builtin:host.cpu.usage',
        from: 'now-24h',
        to: 'now',
        resolution: '1h',
        entitySelector: 'type("HOST")',
      });

      expect(response.result?.length).toBeGreaterThan(0);
      response.result?.forEach((result: any) => {
        expect(result.metricId).toEqual('builtin:host.cpu.usage');

        // Could also assert that entities are of type host, but too brittle.
        // e.g.: result.data[0].dimensionMap."dt.entity.host" has a value starting with "HOST-"
      });
    }, 30000);
  });

  describe('LogsApiClient', () => {
    it('should query logs', async () => {
      const response = await logsClient.queryLogs({
        query: 'error',
        from: 'now-24h',
        to: 'now',
        limit: 5,
      });
      const result = logsClient.formatList(response);

      expect(response).toBeDefined();
      expect(typeof result).toBe('string');
      expect(response?.results?.length).toBeGreaterThan(0);
      expect(result).toMatch(/\[(ERROR|WARNING|INFO)\]/);
    }, 30000);
  });

  describe('EventsApiClient', () => {
    it('should query events', async () => {
      const response = await eventsClient.queryEvents({
        from: 'now-24h',
        to: 'now',
        pageSize: 10,
      });
      const result = eventsClient.formatList(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      expect(result).toContain('eventId:');
      expect(result).toContain('eventType:');
      expect(result).toContain('startTime:');
    }, 30000);

    it('should get event details', async () => {
      const events = await eventsClient.queryEvents({ from: 'now-24h', to: 'now', pageSize: 1 });
      const eventId = events.events ? events.events[0].eventId : undefined;
      if (eventId == undefined) {
        fail('Cannot find eventId from queryEvents; cannot test getEventDetails; aborting');
      }

      const response = await eventsClient.getEventDetails(eventId);
      const result = eventsClient.formatDetails(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      expect(result).toContain(`\"eventId\":\"${eventId}\"`);
    }, 30000);
  });

  describe('EntitiesApiClient', () => {
    it('should list entity types', async () => {
      const response = await entitiesClient.listEntityTypes();
      const result = entitiesClient.formatEntityTypeList(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      expect(result).toContain('SERVICE');
      expect(result).toContain('HOST');
    }, 30000);

    it('should get entity type details', async () => {
      const response = await entitiesClient.getEntityTypeDetails('SERVICE');
      const result = entitiesClient.formatEntityTypeDetails(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      expect(result).toContain('\"type\":\"SERVICE\"');
      expect(result).toContain('\"fromRelationships\":');
      expect(result).toContain('\"toRelationships\":');
    }, 30000);

    it('should list entities by type', async () => {
      const response = await entitiesClient.queryEntities({ entitySelector: 'type(HOST)', pageSize: 10 });
      const result = entitiesClient.formatEntityList(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      expect(response.totalCount).toBeDefined();
      expect(result).toContain('entityId:');
      expect(result).toContain('displayName:');
    }, 30000);

    it('should list entities, respecting all parameters', async () => {
      // Should not throw error even if no management zone named "Production" exists
      const response = await entitiesClient.queryEntities({
        entitySelector: 'type(SERVICE)',
        pageSize: 5,
        mzSelector: 'mzName("Production")',
        from: 'now-1h',
        to: 'now',
        sort: '+name',
      });
      const result = entitiesClient.formatEntityList(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should get entity details', async () => {
      const entities = await entitiesClient.queryEntities({
        entitySelector: 'type(SERVICE)',
        pageSize: 1,
      });
      const entityId = entities.entities ? entities.entities[0].entityId : undefined;
      if (entityId == undefined) {
        fail('Cannot find entityId from queryEntities; cannot test getEntityDetails; aborting');
      }

      const response = await entitiesClient.getEntityDetails(entityId);
      const result = entitiesClient.formatEntityDetails(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      expect(result).toContain(`\"entityId\":\"${entityId}\"`);
    }, 30000);
  });

  describe('ProblemsApiClient', () => {
    it('should list problems', async () => {
      const response = await problemsClient.listProblems({
        from: 'now-24h',
        to: 'now',
        pageSize: 10,
      });
      const result = problemsClient.formatList(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      expect(response.totalCount).toBeDefined();
      expect(result).toContain('problemId:');
      expect(result).toContain('displayId:');
      expect(result).toContain('title:');
      expect(result).toContain('status:');
    }, 30000);

    it('should get problem details', async () => {
      const problems = await problemsClient.listProblems({ pageSize: 1 });
      const problemId = problems.problems ? problems.problems[0].problemId : undefined;
      if (problemId == undefined) {
        fail('Cannot find problemId from listProblems; cannot test getProblemDetails; aborting');
      }

      const response = await problemsClient.getProblemDetails(problemId);
      const result = problemsClient.formatDetails(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      expect(result).toContain(`\"problemId\":\"${problemId}\"`);
    }, 30000);
  });

  describe('SecurityApiClient', () => {
    it('should list security problems', async () => {
      const response = await securityClient.listSecurityProblems();
      const result = securityClient.formatList(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      expect(response.totalCount).toBeDefined();
      expect(result).toContain('securityProblemId:');
      expect(result).toContain('displayId:');
      expect(result).toContain('status:');
    }, 30000);
  });

  describe('SloApiClient', () => {
    it('should list SLOs', async () => {
      const response = await sloClient.listSlos();
      const result = sloClient.formatList(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      if (result.includes('Listing 0 SLOs')) {
        // No SLOs; cannot assert about their contents
      } else {
        expect(result).toContain('id:');
        expect(result).toContain('name:');
        expect(result).toContain('target:');
        expect(result).toContain('enabled:');
      }
    }, 30000);

    it('should get SLO details', async () => {
      const slos = await sloClient.listSlos();
      const sloId = slos.slo && slos.slo.length > 0 ? slos.slo[0].id : undefined;
      if (sloId == undefined) {
        console.warn('Cannot integration test getSLODetails because environment returned no SLOs; aborting');
        logger.warn('Cannot integration test getSLODetails because environment returned no SLOs; aborting');
        return;
      }

      const response = await sloClient.getSloDetails({ id: sloId });
      const result = sloClient.formatDetails(response);
      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      expect(result).toContain('"id":');
      expect(result).toContain('"name":');
      expect(result).toContain('"target":');
      expect(result).toContain('"enabled":');
    }, 30000);

    it('should get SLO details with timeframe', async () => {
      const slos = await sloClient.listSlos();
      const sloId = slos.slo && slos.slo.length > 0 ? slos.slo[0].id : undefined;
      if (sloId == undefined) {
        console.warn('Cannot integration test getSLODetails because environment returned no SLOs; aborting');
        logger.warn('Cannot integration test getSLODetails because environment returned no SLOs; aborting');
        return;
      }

      const to = Date.now();
      const from = to - 1000 * 60 * 60 * 24 * 7 * 11; // 11 weeks ago

      const response = await sloClient.getSloDetails({ id: sloId, from: String(from), to: String(to) });
      const result = sloClient.formatDetails(response);

      expect(response).toBeDefined();
      expect(typeof result).toBe('string');

      expect(result).toContain('"id":');
      expect(result).toContain('"name":');
      expect(result).toContain('"target":');
      expect(result).toContain('"enabled":');
      expect(result).toContain(`"timeframe":"${from} to ${to}"`);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle metrics 404 Bad Request errors correctly', async () => {
      try {
        await metricsClient.queryMetrics({
          metricSelector: 'invalid-metric-selector',
          from: 'now-1h',
          to: 'now',
        });

        fail('Should have thrown an error for invalid parameters');
      } catch (error: any) {
        expect(error.message).toContain('Request failed with status code 404');
      }
    }, 30000);

    it('should handle entities 400 Bad Request errors correctly', async () => {
      try {
        await entitiesClient.queryEntities({ entitySelector: 'invalid-entity-selector' });

        fail('Should have thrown an error for invalid parameters');
      } catch (error: any) {
        expect(error.message).toContain('Request failed with status code 400');
      }
    }, 30000);

    it('should handle invalid problems id errors correctly', async () => {
      try {
        await problemsClient.getProblemDetails('invalid-problem-id');
        fail('Should have thrown an error for invalid parameters');
      } catch (error: any) {
        expect(error.message).toContain('Request failed with status code 400');
      }
    }, 30000);

    it('should handle 401 Unauthorized errors correctly', async () => {
      // Create client with invalid token
      const invalidAuthClient = new ManagedAuthClient(authClient['baseUrl'], 'invalid-token');
      const invalidMetricsClient = new MetricsApiClient(invalidAuthClient);

      try {
        await invalidMetricsClient.listAvailableMetrics({});
        fail('Should have thrown an error for invalid token');
      } catch (error: any) {
        expect(error.message).toContain('Request failed with status code 401');
      }
    }, 30000);
  });
});
