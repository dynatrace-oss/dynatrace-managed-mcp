/**
 * Upper bounds enforced on the `limit` parameter of every list tool.
 *
 * These are validated by zod before the tool callback runs, so a caller cannot ask the cluster for
 * an unbounded number of records. Each bound is paired with the capability client's
 * `API_PAGE_SIZE`, which is the fallback used when the caller omits `limit`; a fallback must never
 * exceed its bound.
 */
export const MAX_ENTITIES_LIMIT = 50;
export const MAX_EVENTS_LIMIT = 100;
export const MAX_LOGS_LIMIT = 1000;
export const MAX_METRICS_LIMIT = 500;
export const MAX_PROBLEMS_LIMIT = 50;
export const MAX_SECURITY_PROBLEMS_LIMIT = 100;
export const MAX_SLOS_LIMIT = 100;
