// Argument shapes for each registered tool. Tools with an empty input schema receive
// `undefined` (the `tool` wrapper's type parameter defaults to `undefined`). All other
// tools are scoped to an environment via `environment_alias`.

export interface EnvironmentScopedArgs {
  environment_alias: string;
}

export interface ListAvailableMetricsArgs extends EnvironmentScopedArgs {
  entitySelector?: string;
  searchText?: string;
  limit?: number;
}

export interface QueryMetricsDataArgs extends EnvironmentScopedArgs {
  metricSelector: string;
  from: string;
  to: string;
  resolution?: string;
  entitySelector?: string;
}

export interface GetMetricDetailsArgs extends EnvironmentScopedArgs {
  metricId: string;
}

export interface QueryLogsArgs extends EnvironmentScopedArgs {
  query: string;
  from: string;
  to: string;
  limit?: number;
  sort?: string;
}

export interface ListEventsArgs extends EnvironmentScopedArgs {
  from: string;
  to: string;
  eventType?: string;
  entitySelector?: string;
  limit?: number;
}

export interface GetEventDetailsArgs extends EnvironmentScopedArgs {
  eventId: string;
}

export interface GetEntityTypeDetailsArgs extends EnvironmentScopedArgs {
  type: string;
}

export interface DiscoverEntitiesArgs extends EnvironmentScopedArgs {
  entitySelector: string;
  mzSelector?: string;
  from?: string;
  to?: string;
  limit?: number;
  sort?: string;
}

export interface GetEntityDetailsArgs extends EnvironmentScopedArgs {
  entityId: string;
}

export interface GetEntityRelationshipsArgs extends EnvironmentScopedArgs {
  entityId: string;
}

export interface ListProblemsArgs extends EnvironmentScopedArgs {
  from?: string;
  to?: string;
  status?: string;
  impactLevel?: string;
  entitySelector?: string;
  limit?: number;
  sort?: string;
}

export interface GetProblemDetailsArgs extends EnvironmentScopedArgs {
  problemId: string;
}

export interface ListSecurityProblemsArgs extends EnvironmentScopedArgs {
  riskLevel?: string;
  status?: string;
  entitySelector?: string;
  from?: string;
  to?: string;
  limit?: number;
  sort?: string;
}

export interface GetSecurityProblemDetailsArgs extends EnvironmentScopedArgs {
  securityProblemId: string;
}

export interface ListSlosArgs extends EnvironmentScopedArgs {
  sloSelector?: string;
  timeFrame?: string;
  from?: string;
  to?: string;
  evaluate?: boolean;
  sort?: string;
  enabledSlos?: string;
  showGlobalSlos?: boolean;
  demo?: boolean;
  limit?: number;
}

export interface GetSloDetailsArgs extends EnvironmentScopedArgs {
  sloId: string;
  from?: string;
  to?: string;
  timeFrame?: string;
}
