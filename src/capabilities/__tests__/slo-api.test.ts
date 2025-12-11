import { SloApiClient, SLO } from '../slo-api';
import { ManagedAuthClient } from '../../authentication/managed-auth-client';
import { readFileSync } from 'fs';

jest.mock('../../authentication/managed-auth-client');

describe('SloApiClient', () => {
  let client: SloApiClient;
  let mockAuthClient: jest.Mocked<ManagedAuthClient>;

  beforeEach(() => {
    mockAuthClient = {
      makeRequest: jest.fn(),
    } as any;
    client = new SloApiClient(mockAuthClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listSlos', () => {
    it('should list SLOs with default parameters', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const result = await client.listSlos();

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/slo', {
        pageSize: SloApiClient.API_PAGE_SIZE,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should list SLOs with all parameters', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const result = await client.listSlos({
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

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/slo', {
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
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getSloDetails', () => {
    it('should get SLO details with defaults', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const result = await client.getSloDetails({ id: 'slo-1' });

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/slo/slo-1', {});
      expect(result).toEqual(mockResponse);
    });

    it('should get SLO details with all parameters', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const result = await client.getSloDetails({
        id: 'slo-1',
        from: 'now-12w',
        to: 'now',
        timeFrame: 'GTF',
      });

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/slo/slo-1', {
        from: 'now-12w',
        to: 'now',
        timeFrame: 'GTF',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should get SLO details with inferred timeFrame', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const result = await client.getSloDetails({
        id: 'slo-1',
        from: 'now-12w',
        to: 'now',
      });

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/slo/slo-1', {
        from: 'now-12w',
        to: 'now',
        timeFrame: 'GTF',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle URL encoding for SLO ID', async () => {
      const sloId = 'slo with spaces';
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      await client.getSloDetails({ id: sloId });

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/slo/slo%20with%20spaces', {});
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
      const response = {
        totalCount: 123,
        slo: mockSLOs,
      };

      const result = client.formatList(response);

      // Should show all 100 SLOs, not just 20
      expect(result).toContain('Listing 100 of 123 SLOs');
      expect(result).toContain('SLO 0');
      expect(result).toContain('SLO 99');
    });

    it('should format list', async () => {
      const mockResponse = JSON.parse(readFileSync('src/capabilities/__tests__/resources/listSlos.json', 'utf8'));
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listSlos();
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 of 1 SLOs');
      expect(result).toContain('id: 1680ea77-eb8d-3611-9aca-99de422c6e2d');
      expect(result).toContain('name: DT-Orders K8 Error Rate');
      expect(result).toContain('status: SUCCESS');
    });

    it('should format list when sparse problem', async () => {
      const mockResponse = {
        slo: [{}],
      };
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listSlos();
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 SLOs');
      expect(result).toContain('id: undefined');
      expect(result).toContain('name: undefined');
      expect(result).toContain('status: undefined');
    });

    it('should format list when empty', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listSlos();
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 0 SLOs');
    });

    it('should handle empty list', () => {
      const response = {
        totalCount: 0,
        slo: [],
      };
      const result = client.formatList(response);
      expect(result).toContain('Listing 0 SLOs');
    });
  });

  describe('formatDetails', () => {
    it('should format details', async () => {
      const mockResponse = JSON.parse(readFileSync('src/capabilities/__tests__/resources/getSloDetails.json', 'utf8'));
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.getSloDetails({ id: 'my-id' });
      const result = client.formatDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of SLO in the following json');
      expect(result).toContain('\"id\":\"0775c411-c3a1-3286-8fd2-8a469ae0a1b9\"');
    });

    it('should format details when sparse problem', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.getSloDetails({ id: 'my-id' });
      const result = client.formatDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of SLO in the following json');
      expect(result).toContain('{}');
    });
  });
});
