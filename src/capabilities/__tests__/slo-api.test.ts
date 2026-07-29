import { SloApiClient, SLO, ListSlosResponse } from '../slo-api';
import { ManagedAuthClientManager } from '../../authentication/managed-auth-client';
import { readFileSync } from 'fs';

jest.mock('../../authentication/managed-auth-client');

describe('SloApiClient', () => {
  let mockAuthManager: jest.Mocked<ManagedAuthClientManager>;
  let client: SloApiClient;

  beforeEach(() => {
    mockAuthManager = {
      makeRequests: jest.fn(),
      getBaseUrl: jest.fn(() => {
        return 'http://dashboardbaseurl.com/e/environment_id';
      }),
    } as unknown as jest.Mocked<ManagedAuthClientManager>;
    client = new SloApiClient(mockAuthManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listSlos', () => {
    it('should list SLOs with default parameters', async () => {
      const mockResponse = new Map<string, ListSlosResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.listSlos('testAlias');

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/slo',
        {
          pageSize: SloApiClient.API_PAGE_SIZE,
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should list SLOs with all parameters', async () => {
      const mockResponse = new Map<string, ListSlosResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.listSlos('testAlias', {
        sloSelector: 'my-selector',
        timeFrame: 'my-timeframe',
        from: 'my-from',
        to: 'my-to',
        demo: true,
        pageSize: 12,
        evaluate: true,
        sort: 'my-sort',
        enabledSlos: 'my-enabled-slos',
        showGlobalSlos: true,
      });

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/slo',
        {
          sloSelector: 'my-selector',
          timeFrame: 'my-timeframe',
          from: 'my-from',
          to: 'my-to',
          demo: true,
          pageSize: 12,
          evaluate: true,
          sort: 'my-sort',
          enabledSlos: 'my-enabled-slos',
          showGlobalSlos: true,
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getSloDetails', () => {
    it('should get SLO details with defaults', async () => {
      const mockResponse = new Map<string, SLO>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.getSloDetails({ id: 'slo-1' }, 'testAlias');

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith('/api/v2/slo/slo-1', {}, 'testAlias');
      expect(result).toEqual(mockResponse);
    });

    it('should get SLO details with all parameters', async () => {
      const mockResponse = new Map<string, SLO>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.getSloDetails(
        {
          id: 'slo-1',
          from: 'now-12w',
          to: 'now',
          timeFrame: 'GTF',
        },
        'testAlias',
      );

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/slo/slo-1',
        {
          from: 'now-12w',
          to: 'now',
          timeFrame: 'GTF',
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should get SLO details with inferred timeFrame', async () => {
      const mockResponse = new Map<string, SLO>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.getSloDetails(
        {
          id: 'slo-1',
          from: 'now-12w',
          to: 'now',
        },
        'testAlias',
      );

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/slo/slo-1',
        {
          from: 'now-12w',
          to: 'now',
          timeFrame: 'GTF',
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle URL encoding for SLO ID', async () => {
      const sloId = 'slo with spaces';
      const mockResponse = new Map<string, SLO>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      await client.getSloDetails({ id: sloId }, 'testAlias');

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith('/api/v2/slo/slo%20with%20spaces', {}, 'testAlias');
    });
  });

  describe('formatList', () => {
    it('should show all retrieved SLOs', () => {
      // Create 100 mock SLOs to test that all are shown
      const mockSLOs: SLO[] = Array.from({ length: 100 }, (_, i) => ({
        id: `slo-${i}`,
        name: `SLO ${i}`,
        enabled: true,
        target: 95,
        warning: 90,
        timeframe: '-1w',
        status: 'SUCCESS',
        errorBudget: 80,
        evaluatedPercentage: 96,
      }));

      const response = new Map<string, ListSlosResponse>([
        [
          'testAlias',
          {
            totalCount: 123,
            slo: mockSLOs,
          },
        ],
      ]);

      const result = client.formatList(response);

      // Should show all 100 SLOs, not just 20
      expect(result).toContain('Listing 100 of 123 SLOs');
      expect(result).toContain('SLO 0');
      expect(result).toContain('SLO 99');
    });

    it('should format list', async () => {
      const mockResponse = new Map<string, ListSlosResponse>([
        ['testAlias', JSON.parse(readFileSync('src/capabilities/__tests__/resources/listSlos.json', 'utf8'))],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listSlos('testAlias');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 of 1 SLOs');
      expect(result).toContain('id: 1680ea77-eb8d-3611-9aca-99de422c6e2d');
      expect(result).toContain('name: DT-Orders K8 Error Rate');
      expect(result).toContain('status: SUCCESS');
    });

    it('should format list when sparse problem', async () => {
      const mockResponse = new Map<string, ListSlosResponse>([
        [
          'testAlias',
          {
            slo: [{}],
          },
        ],
      ]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listSlos('testAlias');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 SLOs');
      expect(result).toContain('id: undefined');
      expect(result).toContain('name: undefined');
      expect(result).toContain('status: undefined');
    });

    it('should format list when empty', async () => {
      const mockResponse = new Map<string, ListSlosResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listSlos('testAlias');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 0 SLOs');
    });

    it('should handle empty list', () => {
      const response = new Map<string, ListSlosResponse>([
        [
          'testAlias',
          {
            totalCount: 0,
            slo: [],
          },
        ],
      ]);

      const result = client.formatList(response);
      expect(result).toContain('Listing 0 SLOs');
    });
  });

  describe('formatDetails', () => {
    it('should format details', async () => {
      const mockResponse = new Map<string, SLO>([
        ['testAlias', JSON.parse(readFileSync('src/capabilities/__tests__/resources/getSloDetails.json', 'utf8'))],
      ]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getSloDetails({ id: 'my-id' }, 'testAlias');
      const result = client.formatDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of SLO from environment testAlias in the following json');
      expect(result).toContain('"id":"0775c411-c3a1-3286-8fd2-8a469ae0a1b9"');
    });

    it('should format details when sparse problem', async () => {
      const mockResponse = new Map<string, SLO>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getSloDetails({ id: 'my-id' }, 'testAlias');
      const result = client.formatDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of SLO from environment testAlias in the following json');
      expect(result).toContain('{}');
    });
  });
});
