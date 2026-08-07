import { EventsApiClient, Event, EventStatus, ListEventsResponse } from '../events-api';
import { ManagedAuthClientManager } from '../../authentication/managed-auth-client';
import { readFileSync } from 'fs';

jest.mock('../../authentication/managed-auth-client');

describe('EventsApiClient', () => {
  let mockAuthManager: jest.Mocked<ManagedAuthClientManager>;
  let client: EventsApiClient;

  beforeEach(() => {
    mockAuthManager = {
      makeRequests: jest.fn(),
      getBaseUrl: jest.fn(() => {
        return 'http://dashboardbaseurl.com/e/environment_id';
      }),
    } as unknown as jest.Mocked<ManagedAuthClientManager>;
    client = new EventsApiClient(mockAuthManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryEvents', () => {
    it('should query events with all parameters', async () => {
      const mockResponse = new Map<string, ListEventsResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.queryEvents(
        {
          from: 'now-1h',
          to: 'now',
          eventType: 'CUSTOM_INFO',
          entitySelector: 'type(SERVICE)',
          pageSize: 50,
        },
        'testAlias',
      );

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/events',
        {
          from: 'now-1h',
          to: 'now',
          pageSize: 50,
          eventType: 'CUSTOM_INFO',
          entitySelector: 'type(SERVICE)',
        },
        'testAlias',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use defaults when not specified', async () => {
      const mockResponse = new Map<string, ListEventsResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      await client.queryEvents(
        {
          from: 'now-1h',
          to: 'now',
        },
        'testAlias',
      );

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith(
        '/api/v2/events',
        {
          from: 'now-1h',
          to: 'now',
          pageSize: 100,
        },
        'testAlias',
      );
    });
  });

  describe('getEventDetails', () => {
    it('should get event details by ID', async () => {
      const mockResponse = new Map<string, Event>([['testAlias', {} as Event]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const result = await client.getEventDetails('event-123', 'testAlias');

      expect(mockAuthManager.makeRequests).toHaveBeenCalledWith('/api/v2/events/event-123', {}, 'testAlias');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('formatList', () => {
    it('should format list', async () => {
      const mockResponse = new Map<string, ListEventsResponse>([
        ['testAlias', JSON.parse(readFileSync('src/capabilities/__tests__/resources/queryEvents.json', 'utf8'))],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryEvents({ from: 'now-1h', to: 'now' }, 'ALL_ENVIRONMENTS');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 of 386 events');
      expect(result).toContain('eventId: -2899693953000578799_1763288686574');
      expect(result).toContain('status: OPEN');
      expect(result).toContain('title: Monitoring not available');
      expect(result).toContain('status: OPEN');
      expect(result).toContain('startTime: 2025-11-16 10:24:46');
      expect(result).not.toContain('endTime:');
    });

    it('should show all retrieved events', () => {
      // Create 75 mock events to test that all are shown
      const mockEvents: Event[] = Array.from({ length: 75 }, (_, i): Event => ({
        eventId: `event-${i}`,
        eventType: 'CUSTOM_INFO',
        title: `Event ${i}`,
        startTime: 1640995200000 + i * 1000,
        entityName: `service-${i}`,
        properties: [],
        managementZones: [],
        status: EventStatus.CLOSED,
      }));

      const response = new Map<string, ListEventsResponse>([
        [
          'testAlias',
          {
            totalCount: 100,
            events: mockEvents,
          },
        ],
      ]);

      const result = client.formatList(response);

      // Should show all 75 events, not just 20
      expect(result).toContain('Listing 75 of 100 events');
      expect(result).toContain('Event 0');
      expect(result).toContain('Event 74');
    });

    it('should format list when sparse problem', async () => {
      const mockResponse = new Map<string, ListEventsResponse>([
        [
          'testAlias',
          {
            events: [{} as Event],
          },
        ],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryEvents({ from: 'now-1h', to: 'now' }, 'testAlias');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 1 event');
      expect(result).toContain('eventId: undefined');
      expect(result).toContain('eventType: undefined');
      expect(result).toContain('status: undefined');
      expect(result).toContain('title: undefined');
      expect(result).not.toContain('startTime');
      expect(result).not.toContain('endTime');
    });

    it('should format list when empty', async () => {
      const mockResponse = new Map<string, ListEventsResponse>([['testAlias', {}]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryEvents({ from: 'now-1h', to: 'now' }, 'testAlias');
      const result = client.formatList(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Listing 0 events');
    });

    it('should handle empty list', async () => {
      const mockResponse = new Map<string, ListEventsResponse>([
        [
          'testAlias',
          {
            totalCount: 0,
            events: [],
          },
        ],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.queryEvents({ from: 'now-1h', to: 'now' }, 'testAlias');
      const result = client.formatList(response);

      expect(result).toContain('Listing 0 events');
    });
  });

  describe('formatDetails', () => {
    it('should format details', async () => {
      const mockResponse = new Map<string, Event>([
        ['testAlias', JSON.parse(readFileSync('src/capabilities/__tests__/resources/getEventDetails.json', 'utf8'))],
      ]);

      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getEventDetails('my-id', 'testAlias');
      const result = client.formatDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Event details from environment testAlias in the following json');
      expect(result).toContain('"eventId":"-2899693953000578799_1763288686574"');
    });

    it('should format details when sparse problem', async () => {
      const mockResponse = new Map<string, Event>([['testAlias', {} as Event]]);
      mockAuthManager.makeRequests.mockResolvedValue(mockResponse);

      const response = await client.getEventDetails('my-id', 'testAlias');
      const result = client.formatDetails(response);

      expect(response).toEqual(mockResponse);
      expect(result).toContain('Event details from environment testAlias in the following json');
      expect(result).toContain('{}');
    });
  });
});
