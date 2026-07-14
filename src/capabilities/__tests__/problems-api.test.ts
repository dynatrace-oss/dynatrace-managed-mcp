import { ProblemsApiClient, Problem, ListProblemResponse } from '../problems-api';
import { ManagedAuthClientManager } from '../../authentication/managed-auth-client';
import { readFileSync } from 'fs';

jest.mock('../../authentication/managed-auth-client');

describe('ProblemsApiClient', () => {
  let mockAuthManager: jest.Mocked<ManagedAuthClientManager>;
  let client: ProblemsApiClient;

  beforeEach(() => {
    mockAuthManager = {
      makeRequests: jest.fn(),
      getBaseUrl: jest.fn(() => {
        return 'http://dashboardbaseurl.com/e/environment_id';
      }),
    } as unknown as jest.Mocked<ManagedAuthClientManager>;
    client = new ProblemsApiClient(mockAuthManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listProblems', () => {
    it('should list problems with all parameters', async () => {
      const mockResponse = new Map<string, ListProblemResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.listProblems(
        {
          from: 'now-24h',
          to: 'now',
          status: 'OPEN',
          impactLevel: 'SERVICE',
          pageSize: 25,
          sort: '-startTime',
        },
        'testAlias',
      );

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/problems',
        {
          pageSize: 25,
          from: 'now-24h',
          to: 'now',
          status: 'OPEN',
          impactLevel: 'SERVICE',
          sort: '-startTime',
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use default parameters when none provided', async () => {
      const mockResponse = new Map<string, ListProblemResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.listProblems({}, 'testAlias');

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/problems',
        {
          pageSize: 50,
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getProblemDetails', () => {
    it('should get problem details by ID', async () => {
      const mockResponse = new Map<string, Problem>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.getProblemDetails('PROBLEM-123', 'testAlias');

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith('/api/v2/problems/PROBLEM-123', {}, 'testAlias');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('formatList', () => {
    it('should format list', async () => {
      const mockResponse = new Map<string, ListProblemResponse>([
        ['testAlias', JSON.parse(readFileSync('src/capabilities/__tests__/resources/listProblems.json', 'utf8'))],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listProblems({}, 'testAlias');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 of 12 problems');
      expect(result).toContain('problemId: -2899693953000578799_1763288686574V2');
      expect(result).toContain('displayId: P-2511198');
      expect(result).toContain('title: Monitoring not available');
      expect(result).toContain('severityLevel: AVAILABILITY');
      expect(result).toContain('status: OPEN');
      expect(result).toContain('startTime: 2025-11-16 10:24:46');
      expect(result).not.toContain('endTime:'); // because it is still open, endTime=-1
    });

    it('should format list when sparse problem', async () => {
      const mockResponse = new Map<string, ListProblemResponse>([['testAlias', { problems: [{}] }]]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listProblems({}, 'ALL_ENVIRONMENTS');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 problems');
      expect(result).toContain('problemId: undefined');
      expect(result).toContain('displayId: undefined');
      expect(result).toContain('title: undefined');
      expect(result).toContain('severityLevel: undefined');
      expect(result).toContain('status: undefined');
      expect(result).not.toContain('startTime');
      expect(result).not.toContain('endTime');
    });

    it('should format list when empty', async () => {
      const mockResponse = new Map<string, ListProblemResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.listProblems({}, 'ALL_ENVIRONMENTS');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 0 problems');
    });

    it('should show all retrieved problems', () => {
      // Create 50 mock problems to test that all are shown
      const mockProblems: Problem[] = Array.from({ length: 50 }, (_, i) => ({
        problemId: `PROBLEM-${i}`,
        displayId: `P-${i}`,
        title: `Problem ${i}`,
        impactLevel: 'SERVICE',
        severityLevel: 'PERFORMANCE',
        status: 'OPEN',
        startTime: 1640995200000 + i * 1000,
      }));

      const response = new Map<string, ListProblemResponse>([
        [
          'testAlias',
          {
            totalCount: 123,
            problems: mockProblems,
          },
        ],
      ]);

      const result = client.formatList(response);

      // Should show all 50 problems, not just 20
      expect(result).toContain('Listing 50 of 123 problems');
      expect(result).toContain('Problem 0');
      expect(result).toContain('Problem 49');
    });

    it('should handle empty list', () => {
      const response = new Map<string, ListProblemResponse>([
        [
          'testAlias',
          {
            totalCount: 0,
            problems: [],
          },
        ],
      ]);
      const result = client.formatList(response);
      expect(result).toContain('Listing 0 problems');
    });
  });

  describe('formatProblemDetails', () => {
    it('should format details', async () => {
      const mockResponse = new Map<string, Problem>([
        ['testAlias', JSON.parse(readFileSync('src/capabilities/__tests__/resources/getProblemDetails.json', 'utf8'))],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getProblemDetails('845025139905093722_1763133360000V2', 'ALL_ENVIRONMENTS');
      const result = client.formatDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of problem from environment testAlias in the following json');
      expect(result).toContain('"problemId":"845025139905093722_1763133360000V2"');
      expect(result).toContain('"displayId":"P-2511153"');
    });

    it('should format details when sparse problem', async () => {
      const mockResponse = new Map<string, Problem>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getProblemDetails('my-id', 'ALL_ENVIRONMENTS');
      const result = client.formatDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of problem from environment testAlias in the following json');
      expect(result).toContain('{}');
    });
  });
});
