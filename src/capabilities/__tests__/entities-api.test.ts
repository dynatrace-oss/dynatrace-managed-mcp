import { EntitiesApiClient, Entity, GetEntityRelationshipsResponse } from '../entities-api';
import { ManagedAuthClient } from '../../authentication/managed-auth-client';
import { readFileSync } from 'fs';

jest.mock('../../authentication/managed-auth-client');

describe('EntitiesApiClient', () => {
  let mockAuthClient: jest.Mocked<ManagedAuthClient>;
  let client: EntitiesApiClient;

  beforeEach(() => {
    mockAuthClient = {
      makeRequest: jest.fn(),
    } as any;
    client = new EntitiesApiClient(mockAuthClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEntityDetails', () => {
    it('should get entity details by ID', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const result = await client.getEntityDetails('SERVICE-123');

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/entities/SERVICE-123');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getEntityRelationships', () => {
    it('should get entity relationships', async () => {
      const mockEntity: Entity = {
        entityId: 'SERVICE-123',
        displayName: 'payment-service',
        entityType: 'SERVICE',
        fromRelationships: [
          {
            id: 'rel-1',
            type: 'CALLS',
            fromEntityId: 'SERVICE-123',
            toEntityId: 'SERVICE-456',
          },
        ],
        toRelationships: [
          {
            id: 'rel-2',
            type: 'RUNS_ON',
            fromEntityId: 'SERVICE-123',
            toEntityId: 'HOST-789',
          },
        ],
      };
      const expectedResponse: GetEntityRelationshipsResponse = {
        entityId: 'SERVICE-123',
        fromRelationships: [
          {
            id: 'rel-1',
            type: 'CALLS',
            fromEntityId: 'SERVICE-123',
            toEntityId: 'SERVICE-456',
          },
        ],
        toRelationships: [
          {
            id: 'rel-2',
            type: 'RUNS_ON',
            fromEntityId: 'SERVICE-123',
            toEntityId: 'HOST-789',
          },
        ],
      };

      mockAuthClient.makeRequest.mockResolvedValue(mockEntity);

      const result = await client.getEntityRelationships('SERVICE-123');

      expect(result).toEqual(expectedResponse);
    });
  });

  describe('formatEntityDetails', () => {
    it('should format details', async () => {
      const mockResponse = JSON.parse(
        readFileSync('src/capabilities/__tests__/resources/getEntityDetails.json', 'utf8'),
      );
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.getEntityDetails('my-id');
      const result = client.formatEntityDetails(response);

      expect(result).toContain('Entity details in the following json');
      expect(result).toContain('"type":"SERVICE"');
      expect(result).toContain('"displayName":"Service"');
    });

    it('should format details when sparse problem', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.getEntityDetails('my-id');
      const result = client.formatEntityDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Entity details in the following json');
      expect(result).toContain('{}');
    });
  });

  describe('formatEntityTypes', () => {
    it('should format list', async () => {
      const mockResponse = JSON.parse(
        readFileSync('src/capabilities/__tests__/resources/listEntityTypes.json', 'utf8'),
      );
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listEntityTypes();
      const result = client.formatEntityTypeList(response);

      expect(result).toContain('Listing 1 of 2 entity types');
      expect(result).toContain('APM_SECURITY_GATEWAY - ActiveGate');
    });

    it('should format list when sparse', async () => {
      const mockResponse = {
        types: [{}],
      };
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listEntityTypes();
      const result = client.formatEntityTypeList(response);

      expect(result).toContain('Listing 1 entity types');
      expect(result).toContain('undefined');
    });

    it('should format list when empty', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listEntityTypes();
      const result = client.formatEntityTypeList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 0 entity types');
    });

    it('should handle empty list', async () => {
      const mockResponse = {
        totalCount: 0,
        types: [],
      };
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listEntityTypes();
      const result = client.formatEntityTypeList(response);
      expect(result).toContain('Listing 0 entity types');
    });
  });

  describe('formatEntityTypeDetails', () => {
    it('should format details', async () => {
      const mockResponse = JSON.parse(
        readFileSync('src/capabilities/__tests__/resources/getEntityTypeDetails.json', 'utf8'),
      );
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.getEntityTypeDetails('SERVICE');
      const result = client.formatEntityTypeDetails(response);

      expect(result).toContain('Entity type details in the following json');
      expect(result).toContain('"displayName":"ActiveGate"');
      expect(result).toContain('"type":"APM_SECURITY_GATEWAY"');
    });

    it('should format list when sparse', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.getEntityTypeDetails('SERVICE');
      const result = client.formatEntityTypeDetails(response);

      expect(result).toContain('Entity type details in the following json');
      expect(result).toContain('{}');
    });
  });

  describe('formatEntityList', () => {
    it('should format list', async () => {
      const mockResponse = JSON.parse(readFileSync('src/capabilities/__tests__/resources/queryEntities.json', 'utf8'));
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.queryEntities({ entitySelector: 'type(SERVICE)' });
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
      const mockResponse = {
        totalCount: 100,
        entities: mockEntities,
      };
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.queryEntities({ entitySelector: 'type(SERVICE)' });
      const result = client.formatEntityList(response);

      // Should show all 60 entities, not just 20
      expect(result).toContain('Listing 60 of 100 entities');
      expect(result).toContain('Entity 0');
      expect(result).toContain('Entity 59');
    });

    it('should handle empty entities list', async () => {
      const mockResponse = {
        totalCount: 0,
        entities: [],
      };
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.queryEntities({ entitySelector: 'type(SERVICE)' });
      const result = client.formatEntityList(response);
      expect(result).toContain('Listing 0 entities');
    });

    it('should handle entities list that is empty', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.queryEntities({ entitySelector: 'type(SERVICE)' });
      const result = client.formatEntityList(response);
      expect(result).toContain('Listing 0 entities');
    });
  });

  describe('formatEntityRelationships', () => {
    it('should format entity relationships', async () => {
      const mockEntity: Entity = {
        entityId: 'SERVICE-123',
        displayName: 'payment-service',
        entityType: 'SERVICE',
        fromRelationships: [
          {
            id: 'rel-1',
            type: 'CALLS',
            fromEntityId: 'SERVICE-123',
            toEntityId: 'SERVICE-456',
          },
        ],
        toRelationships: [
          {
            id: 'rel-2',
            type: 'RUNS_ON',
            fromEntityId: 'SERVICE-123',
            toEntityId: 'HOST-789',
          },
        ],
      };
      const expectedResponse: GetEntityRelationshipsResponse = {
        entityId: 'SERVICE-123',
        fromRelationships: [
          {
            id: 'rel-1',
            type: 'CALLS',
            fromEntityId: 'SERVICE-123',
            toEntityId: 'SERVICE-456',
          },
        ],
        toRelationships: [
          {
            id: 'rel-2',
            type: 'RUNS_ON',
            fromEntityId: 'SERVICE-123',
            toEntityId: 'HOST-789',
          },
        ],
      };

      mockAuthClient.makeRequest.mockResolvedValue(mockEntity);

      const response = await client.getEntityRelationships('SERVICE-123');
      const result = client.formatEntityRelationships(response);

      expect(response).toEqual(expectedResponse);
      expect(result).toContain('Found 1 fromRelationship');
      expect(result).toContain('"id":"rel-1"');
      expect(result).toContain('Found 1 toRelationship');
      expect(result).toContain('"id":"rel-2"');
    });

    it('should return empty array when no relationships exist', async () => {
      const mockEntity: Entity = {
        entityId: 'SERVICE-123',
        displayName: 'isolated-service',
        entityType: 'SERVICE',
      };
      const expectedResponse: GetEntityRelationshipsResponse = {
        entityId: 'SERVICE-123',
        fromRelationships: undefined,
        toRelationships: undefined,
      };

      mockAuthClient.makeRequest.mockResolvedValue(mockEntity);

      const response = await client.getEntityRelationships('SERVICE-123');
      const result = client.formatEntityRelationships(response);

      expect(response).toEqual(expectedResponse);
      expect(result).toContain('No relationships found for entity SERVICE-123');
    });

    it('should handle null relationships without error', async () => {
      const mockEntity = {
        entityId: 'SERVICE-123',
        displayName: 'service-with-undefined-relationships',
        entityType: 'SERVICE',
        fromRelationships: null,
        toRelationships: null,
      };
      const expectedResponse = {
        entityId: 'SERVICE-123',
        fromRelationships: null,
        toRelationships: null,
      };

      mockAuthClient.makeRequest.mockResolvedValue(mockEntity);

      const response = await client.getEntityRelationships('SERVICE-123');
      const result = client.formatEntityRelationships(response);

      expect(response).toEqual(expectedResponse);
      expect(result).toContain('No relationships found for entity SERVICE-123');
    });

    it('should handle non-array relationships without error', async () => {
      const mockEntity: any = {
        entityId: 'SERVICE-123',
        displayName: 'service-with-invalid-relationships',
        entityType: 'SERVICE',
        fromRelationships: 'not-an-array',
        toRelationships: { unexpectedKey: 'unexpected-val' },
      };
      const expectedResponse = {
        entityId: 'SERVICE-123',
        fromRelationships: 'not-an-array',
        toRelationships: { unexpectedKey: 'unexpected-val' },
      };
      // { fromRelationships: 'not-an-array', toRelationships: { invalid: 'object' } }

      mockAuthClient.makeRequest.mockResolvedValue(mockEntity);

      const response = await client.getEntityRelationships('SERVICE-123');
      const result = client.formatEntityRelationships(response);

      expect(response).toEqual(expectedResponse);
      expect(result).toContain('Found 1 fromRelationship');
      expect(result).toContain('not-an-array');
      expect(result).toContain('Found 1 toRelationship');
      expect(result).toContain('{"unexpectedKey":"unexpected-val"}');
    });
  });

  describe('queryEntities', () => {
    it('should query entities by entitySelector', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const result = await client.queryEntities({
        entitySelector: 'type(SERVICE)',
        pageSize: 12,
        mzSelector: 'mzId(123,456)',
        from: 'now-1h',
        to: 'now',
        sort: '-timestamp',
      });

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/entities', {
        entitySelector: 'type(SERVICE)',
        pageSize: 12,
        mzSelector: 'mzId(123,456)',
        from: 'now-1h',
        to: 'now',
        sort: '-timestamp',
      });
      expect(result).toEqual(mockResponse);
    });
  });
});
