# API Token scopes

Different tools call specific endpoints which require specific API Token scope to work properly

| Tool                                             | Endpoint                        | Scope                   |
| ------------------------------------------------ | ------------------------------- | ----------------------- |
| `dynatrace_managed_list_entity_types`            | `/api/v2/entityTypes`           | `entities.read`         |
| `dynatrace_managed_get_entity_type_details`      | `/api/v2/entityTypes/{type}`    | `entities.read`         |
| `dynatrace_managed_discover_entities`            | `/api/v2/entities`              | `entities.read`         |
| `dynatrace_managed_get_entity_details`           | `/api/v2/entities/{entityId}`   | `entities.read`         |
| `dynatrace_managed_get_entity_relationships`     | `/api/v2/entities/{entityId}`   | `entities.read`         |
| `dynatrace_managed_get_environments_info`        | `/api/v1/config/clusterversion` | `DataExport `           |
| `dynatrace_managed_list_events`                  | `/api/v2/events`                | `events.read`           |
| `dynatrace_managed_get_event_details`            | `/api/v2/events/{eventId}`      | `events.read`           |
| `dynatrace_managed_query_logs`                   | `/api/v2/logs/search`           | `logs.read`             |
| `dynatrace_managed_list_available_metrics`       | `/api/v2/metrics`               | `metrics.read`          |
| `dynatrace_managed_query_metrics_data`           | `/api/v2/metrics/query`         | `metrics.read`          |
| `dynatrace_managed_get_metric_details`           | `/api/v2/metrics/{metricKey}`   | `metrics.read`          |
| `dynatrace_managed_list_problems`                | `/api/v2/problems`              | `problems.read`         |
| `dynatrace_managed_get_problem_details`          | `/api/v2/problems/{problemId}`  | `problems.read`         |
| `dynatrace_managed_list_security_problems`       | `/api/v2/securityProblems`      | `securityProblems.read` |
| `dynatrace_managed_get_security_problem_details` | `/api/v2/securityProblems/{id}` | `securityProblems.read` |
| `dynatrace_managed_list_slos`                    | `/api/v2/slo`                   | `slo.read`              |
| `dynatrace_managed_get_slo_details`              | `/api/v2/slo/{id}`              | `slo.read`              |

#### Unique scopes

1. `entities.read`
2. `DataExport`
3. `events.read`
4. `logs.read`
5. `metrics.read`
6. `problems.read`
7. `securityProblems.read`
8. `slo.read`
