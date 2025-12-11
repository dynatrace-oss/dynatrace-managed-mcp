import { ProblemsApiClient, Problem } from '../problems-api';
import { ManagedAuthClient } from '../../authentication/managed-auth-client';
import { readFileSync } from 'fs';

jest.mock('../../authentication/managed-auth-client');

describe('ProblemsApiClient', () => {
  let mockAuthClient: jest.Mocked<ManagedAuthClient>;
  let client: ProblemsApiClient;

  beforeEach(() => {
    mockAuthClient = {
      makeRequest: jest.fn(),
    } as any;
    client = new ProblemsApiClient(mockAuthClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listProblems', () => {
    it('should list problems with all parameters', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue({});

      const result = await client.listProblems({
        from: 'now-24h',
        to: 'now',
        status: 'OPEN',
        impactLevel: 'SERVICE',
        pageSize: 25,
        sort: '-startTime',
      });

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/problems', {
        pageSize: 25,
        from: 'now-24h',
        to: 'now',
        status: 'OPEN',
        impactLevel: 'SERVICE',
        sort: '-startTime',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should use default parameters when none provided', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const result = await client.listProblems();

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/problems', {
        pageSize: 50,
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getProblemDetails', () => {
    it('should get problem details by ID', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const result = await client.getProblemDetails('PROBLEM-123');

      expect(mockAuthClient.makeRequest).toHaveBeenCalledWith('/api/v2/problems/PROBLEM-123');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('formatList', () => {
    it('should format list', async () => {
      const mockResponse = JSON.parse(readFileSync('src/capabilities/__tests__/resources/listProblems.json', 'utf8'));
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listProblems();
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
      const mockResponse = {
        problems: [{}],
      };
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listProblems();
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
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.listProblems();
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
      const response = {
        totalCount: 123,
        problems: mockProblems,
      };

      const result = client.formatList(response);

      // Should show all 50 problems, not just 20
      expect(result).toContain('Listing 50 of 123 problems');
      expect(result).toContain('Problem 0');
      expect(result).toContain('Problem 49');
    });

    it('should handle empty list', () => {
      const response = {
        totalCount: 0,
        problems: [],
      };
      const result = client.formatList(response);
      expect(result).toContain('Listing 0 problems');
    });
  });

  describe('formatProblemDetails', () => {
    it('should format details', async () => {
      const mockResponse = JSON.parse(
        readFileSync('src/capabilities/__tests__/resources/getProblemDetails.json', 'utf8'),
      );
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.getProblemDetails('845025139905093722_1763133360000V2');
      const result = client.formatDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of problem in the following json');
      expect(result).toContain('"problemId":"845025139905093722_1763133360000V2"');
      expect(result).toContain('"displayId":"P-2511153"');
    });

    it('should format details when sparse problem', async () => {
      const mockResponse = {};
      mockAuthClient.makeRequest.mockResolvedValue(mockResponse);

      const response = await client.getProblemDetails('my-id');
      const result = client.formatDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Details of problem in the following json');
      expect(result).toContain('{}');
    });
  });
});
