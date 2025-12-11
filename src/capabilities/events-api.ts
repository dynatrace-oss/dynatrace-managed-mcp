import { ManagedAuthClient } from '../authentication/managed-auth-client.js';

import { formatTimestamp } from '../utils/date-formatter';
import { logger } from '../utils/logger';

export interface EventQueryParams {
  from: string;
  to: string;
  eventType?: string;
  entitySelector?: string;
  pageSize?: number;
}

export interface ListEventsResponse {
  events?: Event[];
  totalCount?: number;
  pageSize?: number;
  nextPageKey?: string;
}

export interface Event {
  eventId: string;
  eventType: string;
  title: string;
  description?: string;
  startTime: number;
  endTime?: number;
  entityId?: string;
  entityName?: string;
  source?: string;
  customProperties?: Record<string, any>;
}

export interface EventSearchResult {
  events: Event[];
  totalCount: number;
  nextPageKey?: string;
}

export class EventsApiClient {
  static readonly API_PAGE_SIZE = 100;
  static readonly MAX_PROPERTIES_DISPLAY = 11;
  static readonly MAX_MANAGEMENT_ZONES_DISPLAY = 11;

  constructor(private authClient: ManagedAuthClient) {}

  async queryEvents(params: EventQueryParams): Promise<ListEventsResponse> {
    const queryParams = {
      from: params.from,
      to: params.to,
      pageSize: params.pageSize || EventsApiClient.API_PAGE_SIZE,
      ...(params.eventType && { eventType: params.eventType }),
      ...(params.entitySelector && { entitySelector: params.entitySelector }),
    };

    const response = await this.authClient.makeRequest('/api/v2/events', queryParams);
    logger.debug('queryEvents response: ', { data: response });
    return response;
  }

  async getEventDetails(eventId: string): Promise<any> {
    const response = await this.authClient.makeRequest(`/api/v2/events/${encodeURIComponent(eventId)}`);
    logger.debug('getEventDetails response: ', { data: response });
    return response;
  }

  formatList(response: ListEventsResponse): string {
    let totalCount = response.totalCount || -1;
    let numEvents = response.events?.length || 0;
    let isLimited = totalCount != 0 - 1 && totalCount > numEvents;

    let result = 'Listing ' + numEvents + (totalCount == -1 ? '' : ' of ' + totalCount) + ' events.\n';

    if (isLimited) {
      result +=
        'Not showing all matching problems. Consider using more specific filters (eventType, entitySelector) to get complete results.\n';
    }

    response.events?.forEach((event: any) => {
      result += `eventId: ${event.eventId}\n`;
      result += `  eventType: ${event.eventType}\n`;
      result += `  status: ${event.status}\n`;
      result += `  title: ${event.title}\n`;
      if (event.description) {
        result += `  ${event.description}\n`;
      }
      if (event.startTime && event.startTime !== -1) {
        result += `. startTime: ${formatTimestamp(event.startTime)}`;
      }
      if (event.endTime && event.endTime !== -1) {
        result += `. endTime: ${formatTimestamp(event.endTime)}`;
      }
      // High Priority: Add severity and impact levels
      if (event.severityLevel) {
        result += `severityLevel: ${event.severityLevel}\n`;
      }
      if (event.impactLevel) {
        result += `impactLevel: ${event.impactLevel}\n`;
      }
      if (event.properties && Object.keys(event.properties).length > 0) {
        const props = Object.entries(event.properties)
          .slice(0, EventsApiClient.MAX_PROPERTIES_DISPLAY)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        result += `Properties: ${props}${Object.keys(event.properties).length > EventsApiClient.MAX_PROPERTIES_DISPLAY ? ` (+${Object.keys(event.properties).length - EventsApiClient.MAX_PROPERTIES_DISPLAY} more)` : ''}\n`;
      }
      if (event.managementZones && event.managementZones.length > 0) {
        const zones = event.managementZones
          .slice(0, EventsApiClient.MAX_MANAGEMENT_ZONES_DISPLAY)
          .map((zone: any) => zone.name || zone.id || zone)
          .join(', ');
        result += `Management Zones: ${zones}${event.managementZones.length > EventsApiClient.MAX_MANAGEMENT_ZONES_DISPLAY ? ` (+${event.managementZones.length - EventsApiClient.MAX_MANAGEMENT_ZONES_DISPLAY} more)` : ''}\n`;
      }

      result += '\n';
    });

    result +=
      '\n' +
      'Next Steps:\n' +
      (numEvents == 0
        ? '* Try broader search terms or expand the time range; if using an entitySelector, check with discover_entities which entities that matches.\n'
        : '') +
      (isLimited
        ? '* Use more restrictive filters, such as a narrower time range or more specific search terms.\n'
        : '') +
      (numEvents > 0
        ? '* If the user is interested in a specific event, use the get_event_details tool. Use the event id for this.\n '
        : '') +
      '* Suggest to the user that they use the Dynatrace UI to view events at ' +
      `${this.authClient.baseUrl}/ by navigating to the relevant entity\n` +
      '* Use list_problems to see what problems Dynatrace knows of, if not already done so.\n';

    return result;
  }

  formatDetails(response: any): string {
    let result =
      `Event details in the following json:\n` +
      JSON.stringify(response) +
      '\n' +
      'Next Steps:\n' +
      '* Suggest to the user that they explore this further in the Dynatrace UI at ' +
      `${this.authClient.baseUrl}/` +
      '\n' +
      '* Use list_problems to see what problems Dynatrace knows of, if not already done so.\n';

    return result;
  }
}
