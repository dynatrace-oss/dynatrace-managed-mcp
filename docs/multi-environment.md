# Multiple environments

The server can query several Dynatrace Managed environments from a single running instance. You address each one by its `alias`.

## Aliases

Choose stable, meaningful aliases for your environments — `production`, `staging` — because that's how both you and the assistant refer to them, in conversation and in rule files.

Use `ALL_ENVIRONMENTS` to query every configured environment at once, or combine specific aliases with `;` (e.g. `production;staging`) to target more than one but not all of them.

If you're using multiple environments, it's strongly recommended you set up [rule files](#rule-files) to guide your assistant in understanding each one.

Be mindful of response volume once more than one environment is in play: the top 10 problems from 2 environments is 20 problems returned to the model, but the top 10 problems from 10 environments is 100 — all landing in the same context window.

## Rule files

For efficient result retrieval from Dynatrace, please consider creating a rule file (e.g., [.github/copilot-instructions.md](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions), [.amazonq/rules/](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/context-project-rules.html)), instructing coding agents on how to get more details for your component/app/service.

Here is an example for someone responsible for the [easytrade](https://github.com/Dynatrace/easytrade) system, who wants to focus on entities and problems related to easytrade.

Please adapt the names and filters to fit your use-cases, components, tagging strategy, deployment environment, etc.

### Example rule file

```markdown
# Dynatrace

We use Dynatrace Managed as our Observability solution. This document provides instructions for retrieving data for the EasyTrade system from Dynatrace using the Dynatrace Managed MCP.

## Best Practices

1. Always use specific time ranges, keeping these narrow (e.g. now-1h, now-24h), to avoid large data queries.
2. For entity selectors, consider using criteria for tags for more precise filtering (if the tagging strategy and naming are understood).

## Entity Selectors for easytrade

Consider using these criteria in the entitySelector to filter data for our easytrade application:

Services:

- `type(SERVICE),entityName.contains("easytrade")`
- `type(SERVICE),tag("app:easytrade")`

Process Groups & Containers:

- `type(PROCESS_GROUP),entityName.contains("easytrade")`
- `type(CONTAINER_GROUP_INSTANCE),entityName.contains("easytrade")`

Hosts:

- `type(HOST),tag("environment:production"),tag("app:easytrade")`

AWS Lambda Functions:

- `type(AWS_LAMBDA_FUNCTION),entityName.contains("easytrade")`
- `type(AWS_LAMBDA_FUNCTION),tag("AWS_REGION:us-west-2"),tag("app:easytrade")`
```

## Steering for multiple Managed environments

In this example, you have multiple Dynatrace Managed environments set up. This might be a development/test/production setup, or a set of entirely different applications. It's recommended to refer to your environments by the same alias you used in the `alias` field of your [configuration file](configuration.md#configuration-fields), to prevent confusion.

```text
# Dynatrace

- I have three separate Dynatrace environments:
   1. "production" is a self-hosted Dynatrace Managed environment. It contains data about my production environment, and
      its issues and problems should outrank any other environment, as this is customer-facing.
      It is accessed via the Dynatrace Managed MCP, named
      dynatrace-managed-mcp-server.
   2. "test" is a self-hosted Dynatrace Managed environment. It contains data about my test environment, which is used to prepare code before going to Production.
      It is accessed via the Dynatrace Managed MCP, named dynatrace-managed-mcp-server.
   3. "development" is a self-hosted Dynatrace Managed environment. It contains data about my development environment,
      which is my lowest priority environment.
      It is accessed via the Dynatrace Managed MCP, named dynatrace-managed-mcp-server
- Be careful of which environment to use.
  If it is unclear, ask which environment to use.
- Must make it very clear to the user which environment data has come from.
```

## Per-environment proxies

Proxies are configured per environment: one environment can route through a proxy while another does not need to. See [Proxy](configuration.md#proxy) for the `httpProxyUrl` / `httpsProxyUrl` fields and the two warnings about how they interact.

## Also running the SaaS MCP?

If you're also running the Dynatrace SaaS MCP alongside this server, see [Hybrid SaaS + Managed setup](hybrid-saas-managed.md) for steering guidance that spans both.
