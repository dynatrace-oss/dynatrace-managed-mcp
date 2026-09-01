---
name: dynatrace-managed
description: Set up and query Dynatrace Managed (self-hosted) through the Dynatrace Managed MCP server - configuring cluster connections and API tokens, choosing the right environment when several are configured, and building entity selectors for logs, metrics, events, problems, security vulnerabilities and SLOs. Use when the user mentions Dynatrace, Dynatrace Managed, observability data for their services, or when a dynatrace_managed_* tool returns a configuration or connection error.
license: Apache-2.0
compatibility: Requires Node.js and network access to a Dynatrace Managed cluster API endpoint.
metadata:
  author: dynatrace-oss
---

# Dynatrace Managed

Guidance for driving the `dynatrace-managed` MCP server. The server sends its own detailed tool
instructions on connect - this skill covers what it cannot: getting it configured, and adapting
queries to this repository's own components and tagging strategy.

## First: is it configured?

The server exits at startup unless exactly one configuration source is present. If tool calls fail
with `Configuration not found`, or `dynatrace_managed_get_environments_info` reports configuration
errors, the user needs to supply credentials - no amount of retrying will fix it.

Two mutually exclusive options, in priority order:

1. **`DT_CONFIG_FILE`** - path to a JSON or YAML file describing the environments. Preferred for more
   than one cluster. Write `apiToken: ${DT_PROD_TOKEN}` and the loader interpolates that variable at
   runtime, so the file itself stays free of secrets and can be committed.
2. **`DT_ENVIRONMENT_CONFIGS`** - a JSON array as a single environment variable. Preferred for one
   cluster and for containerized setups.

Setting both logs a warning and `DT_CONFIG_FILE` wins.

Minimal `DT_ENVIRONMENT_CONFIGS` value:

```json
[
  {
    "alias": "production",
    "apiEndpointUrl": "https://dynatrace.example.com/e/abc12345-1234-1234-1234-123456789abc/api",
    "environmentId": "abc12345-1234-1234-1234-123456789abc",
    "apiToken": "dt0c01...."
  }
]
```

The API token needs read-only scopes. Point the user at
[docs/api_token_scopes.md](https://github.com/dynatrace-oss/dynatrace-managed-mcp/blob/main/docs/api_token_scopes.md)
rather than guessing which scopes a given tool requires, and at
[docs/environment_variables.md](https://github.com/dynatrace-oss/dynatrace-managed-mcp/blob/main/docs/environment_variables.md)
for the full variable list.

Never write a real API token into a file that is tracked by git, and never echo one back in chat.

## Always start with the environment list

Call `dynatrace_managed_get_environments_info` before any other tool. It returns the configured
aliases along with per-environment connection and configuration errors. **Report those errors to the
user before doing anything else** - a partially reachable cluster produces silently incomplete
answers.

Every subsequent tool call takes an `environment_alias`. Use `ALL_ENVIRONMENTS` only when the user
genuinely wants every cluster fanned out; it multiplies load on self-hosted infrastructure.

## Picking the right environment

Two ambiguities cause most wrong answers here:

- **Managed vs. SaaS.** A user may have this server _and_ a Dynatrace SaaS MCP server configured at
  once. These are different backends with different data. If it is not obvious which one the question
  is about, ask. Some organizations have migrated to SaaS and keep Dynatrace Managed only as a
  historical archive - in that case live questions belong to SaaS.
- **Which cluster.** Refer to environments by the `alias` from the configuration, and state in the
  answer which environment the data came from. Do not average or merge results across environments
  without saying so.

## Keeping queries cheap

Dynatrace Managed is self-hosted, so an expensive query degrades the user's own cluster.

- Use narrow relative time ranges: `now-1h`, `now-24h`. Reach for `now-7d` or wider only when the
  question is explicitly historical.
- Filter at the source with an `entitySelector` instead of retrieving broadly and post-filtering.
- When the user names a count ("the first 25 errors"), set `limit` - do not approximate with
  `searchText`.
- Use problem IDs in UUID form from `dynatrace_managed_list_problems`, not the `P-XXXXX` display IDs.

## Entity selectors

`dynatrace_managed_discover_entities` always requires an `entitySelector`, and a selector may name
**exactly one** entity type. Comma-separated criteria are ANDed.

```text
type("SERVICE"),entityName.contains("checkout")
type("SERVICE"),tag("environment:production"),tag("app:checkout")
type("HOST"),healthState("HEALTHY"),mzName("Production")
type("AWS_LAMBDA_FUNCTION"),tag("AWS_REGION:us-west-2")
entityId("SERVICE-123","SERVICE-456")
```

Invalid, and worth recognizing before the API rejects them:

```text
type(SERVICE),type(PROCESS_GROUP)        # only one type per query
entityName("my-service")                 # type() required unless entityId() is used
entityId("ID1") or entityId("ID2")       # no OR; pass both IDs to one entityId()
```

### Adapt this to the repository

Replace the placeholders below with the components and tags actually in use, and keep the list next
to whatever else describes this system. A selector tuned to real tags is the single biggest quality
win available here.

```text
Services:         type("SERVICE"),tag("app:<your-app>")
Process groups:   type("PROCESS_GROUP"),entityName.contains("<your-app>")
Containers:       type("CONTAINER_GROUP_INSTANCE"),entityName.contains("<your-app>")
Hosts:            type("HOST"),tag("environment:production"),tag("app:<your-app>")
```

If the tagging strategy is unknown, discover it first with
`dynatrace_managed_list_entity_types` and `dynatrace_managed_get_entity_type_details` rather than
inventing tag keys.

## Log queries

Simple form: a case-insensitive text search, e.g. `error`.

Structured form, which can be combined with `AND`:

```text
content="error" AND dt.entity.host="HOST-94A1B472D04D89D9"
```

## Workflows

| Goal                   | Sequence                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Incident investigation | `list_problems` -> `get_problem_details`                                                                                        |
| Security assessment    | `list_security_problems` -> `get_security_problem_details`                                                                      |
| SLO / error budget     | `list_slos` -> `get_slo_details`                                                                                                |
| Entity exploration     | `list_entity_types` -> `discover_entities` -> `get_entity_details` -> `list_problems` or `list_events` scoped by that entity ID |

All tool names carry the `dynatrace_managed_` prefix. Each response ends with a `Next Steps` footer -
read it, it names the tool that usefully follows.
