import {
  EntitiesApiClient,
  Entity,
  EntityType,
  GetEntityRelationshipsResponse,
  ListEntitiesResponse,
  ListEntityTypesResponse,
} from '../entities-api';
import { ManagedAuthClientManager } from '../../authentication/managed-auth-client';
import { readFileSync } from 'fs';

jest.mock('../../authentication/managed-auth-client');

describe('EntitiesApiClient', () => {
  let mockAuthManager: jest.Mocked<ManagedAuthClientManager>;
  let client: EntitiesApiClient;

  beforeEach(() => {
    mockAuthManager = {
      makeRequests: jest.fn(),
      getBaseUrl: jest.fn(() => {
        return 'http://dashboardbaseurl.com/e/environment_id';
      }),
    } as unknown as jest.Mocked<ManagedAuthClientManager>;
    client = new EntitiesApiClient(mockAuthManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEntityDetails', () => {
    it('should get entity details by ID', async () => {
      const mockResponse = new Map<string, Entity>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);
      const result = await client.getEntityDetails('SERVICE-123', 'testAlias');

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith('/api/v2/entities/SERVICE-123', {}, 'testAlias');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getEntityRelationships', () => {
    it('should get entity relationships', async () => {
      const mockEntity = new Map<string, Entity>([
        [
          'testAlias',
          {
            entityId: 'SERVICE-123',
            displayName: 'payment-service',
            entityType: 'SERVICE',
            fromRelationships: {
              CALLS: [
                {
                  id: 'SERVICE-123',
                  type: 'SERVICE',
                },
              ],
            },
            toRelationships: {
              RUNS_ON: [
                {
                  id: 'HOST-789',
                  type: 'HOST',
                },
              ],
            },
          },
        ],
      ]);
      const expectedResponse: GetEntityRelationshipsResponse = {
        entityId: 'SERVICE-123',
        fromRelationships: {
          CALLS: [
            {
              id: 'SERVICE-123',
              type: 'SERVICE',
            },
          ],
        },
        toRelationships: {
          RUNS_ON: [
            {
              id: 'HOST-789',
              type: 'HOST',
            },
          ],
        },
      };

      mockAuthManager.makeRequests.mockResolvedValue(mockEntity);
      const result = await client.getEntityRelationships('SERVICE-123', 'testAlias');
      expect(result.get('testAlias')).toEqual(expectedResponse);
    });
  });

  describe('formatEntityDetails', () => {
    it('should format details', async () => {
      const mockResponse = new Map<string, Entity>([
        ['testAlias', JSON.parse(readFileSync('src/capabilities/__tests__/resources/getEntityDetails.json', 'utf8'))],
      ]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getEntityDetails('my-id', 'testAlias');
      const result = client.formatEntityDetails(response);

      expect(result).toContain('Entity details from environment testAlias in the following json');
      expect(result).toContain('"type":"SERVICE"');
      expect(result).toContain('"displayName":"Service"');
    });

    it('should format details when sparse problem', async () => {
      const mockResponse = new Map<string, Entity>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getEntityDetails('my-id', 'testAlias');
      const result = client.formatEntityDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Entity details from environment testAlias in the following json');
      expect(response.get('testAlias')).toEqual({});
    });
  });

  describe('formatEntityTypes', () => {
    it('should format list', async () => {
      const mockResponse = new Map<string, ListEntityTypesResponse>([
        ['testAlias', JSON.parse(readFileSync('src/capabilities/__tests__/resources/listEntityTypes.json', 'utf8'))],
      ]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listEntityTypes('ALL_ENVIRONMENTS');
      const result = client.formatEntityTypeList(response);

      expect(result).toContain('Listing 1 of 2 entity types');
      expect(result).toContain('APM_SECURITY_GATEWAY - ActiveGate');
    });

    it('should format list when sparse', async () => {
      const mockResponse = new Map<string, ListEntityTypesResponse>([
        [
          'testAlias',
          {
            types: [{}],
          },
        ],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listEntityTypes('ALL_ENVIRONMENTS');
      const result = client.formatEntityTypeList(response);

      expect(result).toContain('Listing 1 entity types for environment testAlias');
      expect(result).toContain('undefined');
    });

    it('should format list when empty', async () => {
      const mockResponse = new Map<string, ListEntityTypesResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listEntityTypes('ALL_ENVIRONMENTS');
      const result = client.formatEntityTypeList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 0 entity types for environment testAlias');
    });

    it('should handle empty list', async () => {
      const mockResponse = new Map<string, ListEntityTypesResponse>([
        [
          'testAlias',
          {
            totalCount: 0,
            types: [],
          },
        ],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listEntityTypes('ALL_ENVIRONMENTS');
      const result = client.formatEntityTypeList(response);
      expect(result).toContain('Listing 0 entity types for environment testAlias');
    });
  });

  describe('formatEntityTypeDetails', () => {
    it('should format details', async () => {
      const mockResponse = new Map<string, EntityType>([
        [
          'testAlias',
          JSON.parse(readFileSync('src/capabilities/__tests__/resources/getEntityTypeDetails.json', 'utf8')),
        ],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getEntityTypeDetails('SERVICE', 'ALL_ENVIRONMENTS');
      const result = client.formatEntityTypeDetails(response);

      expect(result).toContain('Entity type details from environment testAlias in the following json');
      expect(result).toContain('"displayName":"ActiveGate"');
      expect(result).toContain('"type":"APM_SECURITY_GATEWAY"');
    });

    it('should format list when sparse', async () => {
      const mockResponse = new Map<string, EntityType>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getEntityTypeDetails('SERVICE', 'ALL_ENVIRONMENTS');
      const result = client.formatEntityTypeDetails(response);

      expect(result).toContain('Entity type details from environment testAlias in the following json');
      expect(result).toContain('{}');
    });
  });

  describe('formatEntityList', () => {
    it('should format list', async () => {
      const mockResponse = new Map<string, ListEntitiesResponse>([
        ['testAlias', JSON.parse(readFileSync('src/capabilities/__tests__/resources/queryEntities.json', 'utf8'))],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryEntities({ entitySelector: 'type(SERVICE)' }, 'ALL_ENVIRONMENTS');
      const result = client.formatEntityList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 of 18 entities');
      expect(result).toContain('entityId: HOST-0F66906C3BC01429');
      expect(result).toContain('displayName: aks-ihudakpool-39785951-vmss00000O.cyat4o4idvyufoehozw0qd...');
      expect(result).toContain('type: HOST');
    });

    it('should show all retrieved entities', async () => {
      // Create 60 mock entities to test that all are shown
      const mockEntities: Entity[] = Array.from({ length: 60 }, (_, i) => ({
        entityId: `ENTITY-${i}`,
        displayName: `Entity ${i}`,
        entityType: 'SERVICE',
        tags: [{ context: 'CONTEXTLESS', key: 'environment', value: 'production' }],
      }));
      const mockResponse = new Map<string, ListEntitiesResponse>([
        [
          'testAlias',
          {
            totalCount: 100,
            entities: mockEntities,
          },
        ],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryEntities({ entitySelector: 'type(SERVICE)' }, 'ALL_ENVIRONMENTS');
      const result = client.formatEntityList(response);

      // Should show all 60 entities, not just 20
      expect(result).toContain('Listing 60 of 100 entities');
      expect(result).toContain('Entity 0');
      expect(result).toContain('Entity 59');
    });

    it('should handle empty entities list', async () => {
      const mockResponse = new Map<string, ListEntitiesResponse>([
        [
          'testAlias',
          {
            totalCount: 0,
            entities: [],
          },
        ],
      ]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryEntities({ entitySelector: 'type(SERVICE)' }, 'ALL_ENVIRONMENTS');
      const result = client.formatEntityList(response);
      expect(result).toContain('Listing 0 entities');
    });

    it('should handle entities list that is empty', async () => {
      const mockResponse = new Map<string, ListEntitiesResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryEntities({ entitySelector: 'type(SERVICE)' }, 'ALL_ENVIRONMENTS');
      const result = client.formatEntityList(response);
      expect(result).toContain('Listing 0 entities');
    });
  });

  describe('formatEntityRelationships', () => {
    it('should format entity relationships', async () => {
      const mockEntity = new Map<string, Entity>([
        [
          'testAlias',
          {
            entityId: 'SERVICE-123',
            displayName: 'payment-service',
            entityType: 'SERVICE',
            fromRelationships: {
              CALLS: [
                {
                  id: 'SERVICE-123',
                  type: 'SERVICE',
                },
              ],
            },
            toRelationships: {
              RUNS_ON: [
                {
                  id: 'HOST-789',
                  type: 'HOST',
                },
              ],
            },
          },
        ],
      ]);

      const expectedResponse: GetEntityRelationshipsResponse = {
        entityId: 'SERVICE-123',
        fromRelationships: {
          CALLS: [
            {
              id: 'SERVICE-123',
              type: 'SERVICE',
            },
          ],
        },
        toRelationships: {
          RUNS_ON: [
            {
              id: 'HOST-789',
              type: 'HOST',
            },
          ],
        },
      };

      mockAuthManager.makeRequests.mockResolvedValue(mockEntity);

      const response = await client.getEntityRelationships('SERVICE-123', 'testAlias');
      const result = client.formatEntityRelationships(response);

      expect(response.get('testAlias')).toEqual(expectedResponse);
      expect(result).toContain('Found 1 fromRelationship');
      expect(result).toContain('Found 1 toRelationship');
    });

    it('should return empty array when no relationships exist', async () => {
      const mockEntity = new Map<string, Entity>([
        [
          'testAlias',
          {
            entityId: 'SERVICE-123',
            displayName: 'isolated-service',
            entityType: 'SERVICE',
          },
        ],
      ]);

      const expectedResponse: GetEntityRelationshipsResponse = {
        entityId: 'SERVICE-123',
        fromRelationships: undefined,
        toRelationships: undefined,
      };

      mockAuthManager.makeRequests.mockResolvedValue(mockEntity);

      const response = await client.getEntityRelationships('SERVICE-123', 'testAlias');
      const result = client.formatEntityRelationships(response);

      expect(response.get('testAlias')).toEqual(expectedResponse);
      expect(result).toContain('No relationships found for entity SERVICE-123');
    });

    it('should handle non-array relationships without error', async () => {
      const mockEntity = new Map<string, Record<string, unknown>>([
        [
          'testAlias',
          {
            entityId: 'SERVICE-123',
            displayName: 'service-with-invalid-relationships',
            entityType: 'SERVICE',
            fromRelationships: 'not-an-array',
            toRelationships: { unexpectedKey: 'unexpected-val' },
          },
        ],
      ]);

      const expectedResponse = {
        entityId: 'SERVICE-123',
        fromRelationships: 'not-an-array',
        toRelationships: { unexpectedKey: 'unexpected-val' },
      };
      // { fromRelationships: 'not-an-array', toRelationships: { invalid: 'object' } }

      mockAuthManager.makeRequests.mockResolvedValue(mockEntity);

      const response = await client.getEntityRelationships('SERVICE-123', 'testAlias');
      const result = client.formatEntityRelationships(response);

      expect(response.get('testAlias')).toEqual(expectedResponse);
      expect(result).toContain('Found 1 fromRelationship');
      expect(result).toContain('not-an-array');
      expect(result).toContain('Found 1 toRelationship');
      expect(result).toContain('{"unexpectedKey":"unexpected-val"}');
    });
  });

  describe('queryEntities', () => {
    it('should query entities by entitySelector', async () => {
      const mockResponse = new Map<string, ListEntitiesResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.queryEntities(
        {
          entitySelector: 'type(SERVICE)',
          pageSize: 12,
          mzSelector: 'mzId(123,456)',
          from: 'now-1h',
          to: 'now',
          sort: '-timestamp',
        },
        'testAlias',
      );

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/entities',
        {
          entitySelector: 'type(SERVICE)',
          pageSize: 12,
          mzSelector: 'mzId(123,456)',
          from: 'now-1h',
          to: 'now',
          sort: '-timestamp',
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should fall back to API_PAGE_SIZE when no page size is given', async () => {
      const mockResponse = new Map<string, ListEntitiesResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      await client.queryEntities({ entitySelector: 'type(SERVICE)' }, 'testAlias');

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/entities',
        {
          entitySelector: 'type(SERVICE)',
          pageSize: EntitiesApiClient.API_PAGE_SIZE,
        },
        'testAlias',
      );
    });
  });
});
