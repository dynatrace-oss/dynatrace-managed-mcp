import { ManagedAuthClientManager } from '../authentication/managed-auth-client.js';

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
  properties: EventProperty[];
  managementZones: ManagementZone[];
  status: EventStatus;
}

export interface EventProperty {
  key: string;
  value: string;
}

interface ManagementZone {
  id: string;
  name: string;
}

export enum EventStatus {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
}

export class EventsApiClient {
  static readonly API_PAGE_SIZE = 100;
  static readonly MAX_PROPERTIES_DISPLAY = 11;
  static readonly MAX_MANAGEMENT_ZONES_DISPLAY = 11;

  constructor(private authManager: ManagedAuthClientManager) {}

  async queryEvents(params: EventQueryParams, environment_aliases: string): Promise<Map<string, ListEventsResponse>> {
    const queryParams = {
      from: params.from,
      to: params.to,
      pageSize: params.pageSize || EventsApiClient.API_PAGE_SIZE,
      ...(params.eventType && { eventType: params.eventType }),
      ...(params.entitySelector && { entitySelector: params.entitySelector }),
    };

    const responses = await this.authManager.makeRequests('/api/v2/events', queryParams, environment_aliases);
    logger.debug('queryEvents response: ', { data: responses });
    return responses;
  }

  async getEventDetails(eventId: string, environment_aliases: string): Promise<Map<string, Event>> {
    const responses = await this.authManager.makeRequests(
      `/api/v2/events/${encodeURIComponent(eventId)}`,
      {},
      environment_aliases,
    );
    logger.debug('getEventDetails response: ', { data: responses });
    return responses;
  }

  formatList(responses: Map<string, ListEventsResponse>): string {
    let result = '';
    let totalNumEvents = 0;
    let anyLimited = false;
    const aliases: string[] = [];

    for (const [alias, data] of responses) {
      aliases.push(alias);
      const totalCount = data.totalCount || -1;
      const numEvents = data.events?.length || 0;
      totalNumEvents += numEvents;
      const isLimited = totalCount != 0 - 1 && totalCount > numEvents;

      result +=
        'Listing ' +
        numEvents +
        (totalCount == -1 ? '' : ' of ' + totalCount) +
        ' events from environment ' +
        alias +
        '.\n\n';

      if (isLimited) {
        result +=
          'Not showing all matching problems. Consider using more specific filters (eventType, entitySelector) to get complete results.\n';
        anyLimited = true;
      }

      data.events?.forEach((event: Event) => {
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
            .map((zone: ManagementZone) => zone.name || zone.id || zone)
            .join(', ');
          result += `Management Zones: ${zones}${event.managementZones.length > EventsApiClient.MAX_MANAGEMENT_ZONES_DISPLAY ? ` (+${event.managementZones.length - EventsApiClient.MAX_MANAGEMENT_ZONES_DISPLAY} more)` : ''}\n`;
        }

        result += '\n';
      });
    }
    const baseUrl = aliases.length == 1 ? this.authManager.getBaseUrl(aliases[0]) : '';
    result +=
      '\n' +
      'Next Steps:\n' +
      (totalNumEvents == 0
        ? '* Try broader search terms or expand the time range; if using an entitySelector, check with discover_entities which entities that matches.\n'
        : '') +
      (anyLimited
        ? '* Use more restrictive filters, such as a narrower time range or more specific search terms.\n'
        : '') +
      (totalNumEvents > 0
        ? '* If the user is interested in a specific event, use the get_event_details tool. Use the event id for this.\n '
        : '') +
      '* Suggest to the user that they use the Dynatrace UI' +
      (baseUrl ? ` at ${baseUrl} ` : ' ') +
      +'to view events by navigating to the relevant entity\n' +
      '* Use list_problems to see what problems Dynatrace knows of, if not already done so.\n';

    return result;
  }

  formatDetails(responses: Map<string, Event>): string {
    let result = '';
    const aliases: string[] = [];
    for (const [alias, data] of responses) {
      aliases.push(alias);
      result += 'Event details from environment ' + alias + ' in the following json:\n' + JSON.stringify(data) + '\n';
    }
    const baseUrl = aliases.length == 1 ? this.authManager.getBaseUrl(aliases[0]) : '';
    result +=
      'Next Steps:\n' +
      '* Suggest to the user that they explore this further in the Dynatrace UI' +
      (baseUrl ? ` at ${baseUrl} ` : '.') +
      '\n* Use list_problems to see what problems Dynatrace knows of, if not already done so.\n';
    return result;
  }
}
