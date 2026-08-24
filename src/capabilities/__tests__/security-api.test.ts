import { SecurityApiClient, SecurityProblem, ListSecurityProblemsResponse } from '../security-api';
import { ManagedAuthClientManager } from '../../authentication/managed-auth-client';
import { readFileSync } from 'fs';
import { AxiosError } from 'axios';

jest.mock('../../authentication/managed-auth-client');

describe('SecurityApiClient', () => {
  let mockAuthManager: jest.Mocked<ManagedAuthClientManager>;
  let client: SecurityApiClient;

  beforeEach(() => {
    mockAuthManager = {
      makeRequests: jest.fn(),
      getBaseUrl: jest.fn(() => {
        return 'http://dashboardbaseurl.com/e/environment_id';
      }),
    } as unknown as jest.Mocked<ManagedAuthClientManager>;
    client = new SecurityApiClient(mockAuthManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listSecurityProblems', () => {
    it('should list security problems with default parameters', async () => {
      const mockResponse = new Map<string, ListSecurityProblemsResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.listSecurityProblems('testAlias');

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/securityProblems',
        {
          pageSize: SecurityApiClient.API_PAGE_SIZE,
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should list security problems with all parameters', async () => {
      const mockResponse = new Map<string, ListSecurityProblemsResponse>([['testAlias', { securityProblems: [] }]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      await client.listSecurityProblems('testAlias', {
        riskLevel: 'LOW',
        status: 'OPEN',
        entitySelector: 'my-entity-selector',
        from: 'my-from',
        to: 'my-to',
        pageSize: 12,
        sort: 'my-sort',
      });

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/securityProblems',
        {
          pageSize: 12,
          riskLevel: 'LOW',
          securityProblemSelector: 'status("OPEN")',
          entitySelector: 'my-entity-selector',
          from: 'my-from',
          to: 'my-to',
          sort: 'my-sort',
        },
        'testAlias',
      );
    });

    it('should handle API errors', async () => {
      mockAuthManager.makeRequests.mockRejectedValue({
        response: { data: { message: 'Request failed with status code 404' } },
      });

      try {
        await client.listSecurityProblems('testAlias');
        fail('Should have propagated exception');
      } catch (error) {
        const axiosError = error as AxiosError<{ message: string }>;
        expect(axiosError.response?.data?.message).toEqual('Request failed with status code 404');
      }
    });
  });

  describe('getSecurityProblemDetails', () => {
    it('should get security problem details', async () => {
      const mockResponse = new Map<string, SecurityProblem>([['testAlias', { securityProblemId: 'SP-123' }]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.getSecurityProblemDetails('SP-123', 'testAlias');

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith('/api/v2/securityProblems/SP-123', {}, 'testAlias');
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors', async () => {
      mockAuthManager.makeRequests.mockRejectedValue({
        response: { data: { message: 'Request failed with status code 404' } },
      });

      try {
        await client.getSecurityProblemDetails('SP-999', 'testAlias');
        fail('Should have propagated exception');
      } catch (error) {
        const axiosError = error as AxiosError<{ message: string }>;
        expect(axiosError.response?.data?.message).toEqual('Request failed with status code 404');
      }
    });
  });

  describe('formatList', () => {
    it('should format list', async () => {
      const mockResponse = new Map<string, ListSecurityProblemsResponse>([
        [
          'testAlias',
          JSON.parse(readFileSync('src/capabilities/__tests__/resources/listSecurityProblems.json', 'utf8')),
        ],
      ]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listSecurityProblems('testAlias');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 of 214 security vulnerabilities');
      expect(result).toContain('securityProblemId: 10965700244432082338');
      expect(result).toContain('displayId: S-3');
      expect(result).toContain('title: Improper Input Validation');
      expect(result).toContain('status: OPEN');
      expect(result).toContain('firstSeen: 2025-11-06 16:08:55');
      expect(result).toContain('cveIds: CVE-2025-1767');
    });

    it('should show all retrieved security problems', () => {
      // Create 100 mock security problems to test that all are shown
      const mockProblems: SecurityProblem[] = Array.from({ length: 100 }, (_, i) => ({
        securityProblemId: `SP-${i}`,
        displayId: `SP-${i}`,
        status: 'OPEN',
        title: `Security Problem ${i}`,
      }));

      const response = new Map<string, ListSecurityProblemsResponse>([
        [
          'testAlias',
          {
            totalCount: 123,
            securityProblems: mockProblems,
          },
        ],
      ]);

      const result = client.formatList(response);

      // Should show all 100 problems
      expect(result).toContain('Listing 100 of 123 security vulnerabilities');
      expect(result).toContain('Security Problem 0');
      expect(result).toContain('Security Problem 99');
    });

    it('should format list when sparse problem', async () => {
      const mockResponse = new Map<string, ListSecurityProblemsResponse>([['testAlias', { securityProblems: [{}] }]]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listSecurityProblems('testAlias');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 security vulnerabilities');
      expect(result).toContain('securityProblemId: undefined');
      expect(result).toContain('displayId: undefined');
      expect(result).toContain('title: undefined');
      expect(result).toContain('status: undefined');
    });

    it('should format list when empty', async () => {
      const mockResponse = new Map<string, ListSecurityProblemsResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listSecurityProblems('testAlias');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 0 security vulnerabilities');
    });

    it('should handle empty list', () => {
      const response = new Map<string, ListSecurityProblemsResponse>([
        [
          'testAlias',
          {
            totalCount: 0,
            securityProblems: [],
          },
        ],
      ]);

      const result = client.formatList(response);
      expect(result).toContain('Listing 0 security vulnerabilities');
    });
  });

  describe('formatProblemDetails', () => {
    it('should format details', async () => {
      const mockResponse = new Map<string, SecurityProblem>([
        [
          'testAlias',
          JSON.parse(readFileSync('src/capabilities/__tests__/resources/getSecurityProblemDetails.json', 'utf8')),
        ],
      ]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getSecurityProblemDetails('my-id', 'testAlias');
      const result = client.formatDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of security problem from environment testAlias in the following json');
      expect(result).toContain('"securityProblemId":"SP-123"');
    });

    it('should format details when sparse problem', async () => {
      const mockResponse = new Map<string, SecurityProblem>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getSecurityProblemDetails('my-id', 'testAlias');
      const result = client.formatDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of security problem from environment testAlias in the following json');
      expect(result).toContain('{}');
    });
  });
});
