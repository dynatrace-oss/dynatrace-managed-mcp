import { ManagedAuthClient } from '../authentication/managed-auth-client.js';

import { formatTimestamp } from '../utils/date-formatter';
import { logger } from '../utils/logger';

export interface EntityQueryParams {
  entitySelector: string;
  pageSize?: number;
  mzSelector?: string;
  from?: string;
  to?: string;
  sort?: string;
}

export interface ListEntityTypesResponse {
  types?: EntityType[];
  totalCount?: number;
  pageSize?: number;
  nextPageKey?: string;
}

export interface ListEntitiesResponse {
  entities?: Entity[];
  totalCount?: number;
  pageSize?: number;
  nextPageKey?: string;
}

// Could be a list or a map; hence using 'any'
// e.g. see example response body at https://docs.dynatrace.com/docs/discover-dynatrace/references/dynatrace-api/environment-api/entity-v2/get-entity
export interface GetEntityRelationshipsResponse {
  entityId?: string;
  fromRelationships?: any;
  toRelationships?: any;
}

export interface Entity {
  entityId?: string;
  displayName?: string;
  entityType?: string;
  type?: string; // Alternative field name used by some API responses
  firstSeenTms?: number;
  lastSeenTms?: number;
  tags?: Tag[];
  properties?: Record<string, any>;
  fromRelationships?: any; // Could be a list or a map; hence using 'any'
  toRelationships?: any; // Could be a list or a map; hence using 'any'
  managementZones?: any[];
}

export interface Tag {
  context?: string;
  key?: string;
  value?: string;
}

export interface Relationship {
  id?: string;
  type?: string;
  fromEntityId?: string;
  toEntityId?: string;
}

export interface EntityType {
  type?: string;
  displayName?: string;
  properties?: string[];
}

export class EntitiesApiClient {
  static readonly API_PAGE_SIZE = 100;
  static readonly MAX_TAGS_DISPLAY = 11;
  static readonly MAX_PROPERTIES_DISPLAY = 11;
  static readonly MAX_MANAGEMENT_ZONES_DISPLAY = 11;

  constructor(private authClient: ManagedAuthClient) {}

  async listEntityTypes(): Promise<ListEntityTypesResponse> {
    // Deliberately large page size; will format this concisely rather than returning all json in tool response.
    // Want to get all of them (with reason), otherwise trying to pull out common types won't work.
    const params: Record<string, any> = {
      pageSize: 500,
    };
    const response = await this.authClient.makeRequest('/api/v2/entityTypes', params);
    logger.debug('listEntityTypes response', { data: response });
    return response;
  }

  async getEntityTypeDetails(entityType: string): Promise<any> {
    const response = await this.authClient.makeRequest(`/api/v2/entityTypes/${encodeURIComponent(entityType)}`);
    logger.debug(`getEntityTypeDetails response, entityType=${entityType}`, { data: response });
    return response;
  }

  async getEntityDetails(entityId: string): Promise<any> {
    const response = await this.authClient.makeRequest(`/api/v2/entities/${encodeURIComponent(entityId)}`);
    logger.debug(`getEntityDetails response, entityId=${entityId}`, { data: response });
    return response;
  }

  async getEntityRelationships(entityId: string): Promise<GetEntityRelationshipsResponse> {
    const response = await this.getEntityDetails(entityId);

    return {
      entityId: response.entityId,
      fromRelationships: response.fromRelationships,
      toRelationships: response.toRelationships,
    };
  }

  async queryEntities(params: EntityQueryParams): Promise<ListEntitiesResponse> {
    const queryParams = {
      pageSize: params.pageSize || EntitiesApiClient.API_PAGE_SIZE,
      entitySelector: params.entitySelector,
      ...(params.mzSelector && { mzSelector: params.mzSelector }),
      ...(params.from && { from: params.from }),
      ...(params.to && { to: params.to }),
      ...(params.sort && { sort: params.sort }),
    };

    const response = await this.authClient.makeRequest('/api/v2/entities', queryParams);
    logger.debug('queryEntities response: ', { queryParams: queryParams, data: response });
    return response;
  }

  formatEntityList(response: ListEntitiesResponse): string {
    let totalCount = response.totalCount || -1;
    let numEntities = response.entities?.length || 0;
    let isLimited = totalCount != 0 - 1 && totalCount > numEntities;

    let result = 'Listing ' + numEntities + (totalCount == -1 ? '' : ' of ' + totalCount) + ' entities.\n';
    if (isLimited) {
      result +=
        'Not showing all matching entities. Consider using more specific filters (entitySelector) to get complete results.\n';
    }

    response.entities?.forEach((entity: any) => {
      // Truncate very long names for readability
      let displayName = entity.displayName;
      if (displayName.length > 60) {
        displayName = displayName.substring(0, 57) + '...';
      }

      result += `entityId: ${entity.entityId}\n`;
      result += `  type: ${entity.type || entity.entityType}\n`;
      result += `  displayName: ${displayName}\n`;

      if (entity.tags && entity.tags.length > 0) {
        const tags = entity.tags
          .slice(0, EntitiesApiClient.MAX_TAGS_DISPLAY)
          .map((tag: any) => (tag.value ? `${tag.key}:${tag.value}` : tag.key))
          .join(', ');
        result += `  tags: ${tags}${entity.tags.length > EntitiesApiClient.MAX_TAGS_DISPLAY ? ` (+${entity.tags.length - EntitiesApiClient.MAX_TAGS_DISPLAY} more)` : ''}\n`;
      }

      if (entity.properties && Object.keys(entity.properties).length > 0) {
        const props = Object.entries(entity.properties)
          .slice(0, EntitiesApiClient.MAX_PROPERTIES_DISPLAY)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        result += `  properties: ${props}${Object.keys(entity.properties).length > EntitiesApiClient.MAX_PROPERTIES_DISPLAY ? ` (+${Object.keys(entity.properties).length - EntitiesApiClient.MAX_PROPERTIES_DISPLAY} more)` : ''}\n`;
      }

      if (entity.managementZones && entity.managementZones.length > 0) {
        const zones = entity.managementZones
          .slice(0, EntitiesApiClient.MAX_MANAGEMENT_ZONES_DISPLAY)
          .map((zone: any) => zone.name || zone.id || zone)
          .join(', ');
        result += `  Management Zones: ${zones}${entity.managementZones.length > EntitiesApiClient.MAX_MANAGEMENT_ZONES_DISPLAY ? ` (+${entity.managementZones.length - EntitiesApiClient.MAX_MANAGEMENT_ZONES_DISPLAY} more)` : ''}\n`;
      }

      result += '\n';
    });

    result +=
      '\n' +
      'Next Steps:\n' +
      (numEntities == 0
        ? '* Verify that the filters such as entitySelector were correct, and search again with different filters.\n'
        : '') +
      (isLimited ? '* Use more restrictive filters, such as a more specific entitySelector.\n' : '') +
      '* If the user is interested in a specific entity, use the get_entity_details tool. ' +
      'Use the entityId (UUID) for detailed analysis\n' +
      '* If this has returned the entities that the user wanted, consider using the same entitySelector in subsequent calls such as to list_problems tool if that has not already been done.\n' +
      'Use the entityId (UUID) for detailed analysis\n' +
      '* Suggest to the user that they view the entities in the Dynatrace UI at ' +
      `${this.authClient.baseUrl}/` +
      '\n';

    return result;
  }

  formatEntityTypeList(response: ListEntityTypesResponse): string {
    let totalCount = response.totalCount || -1;
    let numTypes = response.types?.length || 0;
    let isLimited = totalCount != 0 - 1 && totalCount > numTypes;

    let entityTypes = response.types as any[];

    // Produce a simple strong list of all the types from the json (excluding all details).
    // Also call out some common types (that are available).
    const commonTypes = [
      'SERVICE',
      'PROCESS_GROUP',
      'HOST',
      'APPLICATION',
      'CLOUD_APPLICATION',
      'CONTAINER_GROUP_INSTANCE',
      'AWS_LAMBDA_FUNCTION',
      'AZURE_WEB_APP',
    ];
    let conciseList = '';
    let availableCommonTypes: string[] = [];
    entityTypes?.forEach((entityType: any) => {
      conciseList += `${entityType?.type}`;
      if (entityType.displayName && entityType.displayName !== entityType.type) {
        conciseList += ` - ${entityType.displayName}`;
      }
      conciseList += '\n';

      if (commonTypes.includes(entityType)) {
        availableCommonTypes.push(entityType);
      }
    });

    let result = 'Listing ' + numTypes + (totalCount == -1 ? '' : ' of ' + totalCount) + ' entity types.\n';
    if (isLimited) {
      result += 'Not showing all matching entity types as there are too many.\n';
    }

    if (availableCommonTypes.length > 0) {
      result += '\n' + `Common entity types include: ${availableCommonTypes}\n`;
    }

    result +=
      '\n' +
      conciseList +
      '\n' +
      '\n' +
      'Next Steps:\n' +
      '* To get details of a particular entity type, use the get_entity_type_details tool, passing in the type name\n' +
      '* For subsequent user queries, consider using the entity type in the the entitySelector parameter like "type(HOST)" or "type(SERVICE)".\n';
    '* Suggest to the user that they look in the Dynatrace UI at ' + `${this.authClient.baseUrl}/` + '\n';

    return result;
  }

  formatEntityTypeDetails(response: any): string {
    let result =
      `Entity type details in the following json:\n` +
      JSON.stringify(response) +
      '\n' +
      'Next Steps:\n' +
      '* To find entities of this type, use discover_entities tool, using the type in the entitySelector such as type("HOST") or type("SERVICE")\n';

    return result;
  }

  formatEntityDetails(response: any): string {
    let result =
      `Entity details in the following json:\n` +
      JSON.stringify(response) +
      '\n' +
      'Next Steps:\n' +
      '* Use list_problems or list_events tools with the same entitySelector to check for relates issues and events.\n' +
      '* Suggest to the user that they view the entity in the Dynatrace UI at ' +
      `${this.authClient.baseUrl}/ui/entity/<entityId>, using the entityId in the URL` +
      '\n';

    return result;
  }

  formatEntityRelationships(response: GetEntityRelationshipsResponse): string {
    const from = response.fromRelationships;
    const to = response.toRelationships;
    const numFrom = this.countRelationships(from);
    const numTo = this.countRelationships(to);

    if (numFrom == 0 && numTo == 0) {
      return `No relationships found for entity ${response.entityId}.\n`;
    }

    let result = '';
    if (numFrom > 0) {
      result += `Found ${numFrom} fromRelationships:\n`;
      result += `* ${JSON.stringify(from)}\n`;
    }
    if (numTo > 0) {
      result += `Found ${numTo} toRelationships:\n`;
      result += `* ${JSON.stringify(to)}\n`;
    }

    result +=
      'Next Steps:\n' +
      '* Use get_entity_details tool to get more details of this entity, or of entities that it has a relationship to/from.\n' +
      '* Use list_problems or list_events tools with the same entitySelector by entityId to check for related issues and events.\n' +
      '* Suggest to the user that they view the entity in the Dynatrace UI at ' +
      `${this.authClient.baseUrl}/ui/entity/<entityId>, using the entityId in the URL` +
      '\n';

    return result;
  }

  private countRelationships(val: any): number {
    if (!val) return 0;
    if (Array.isArray(val)) return val.length;
    if (typeof val === 'object') return Object.keys(val).length;
    return 1;
  }
}
