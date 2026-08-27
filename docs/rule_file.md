# Rule File

For efficient result retrieval from Dynatrace, please consider creating a rule file (e.g., [.github/copilot-instructions.md](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions), [.amazonq/rules/](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/context-project-rules.html)), instructing coding agents on how to get more details for your component/app/service.

Here is an example for someone responsible for the [easytrade](https://github.com/Dynatrace/easytrade) system, who wants to focus on entities and problems related to easytrade.

Please adapt the names and filters to fit your use-cases, components, tagging strategy, deployment environment, etc.

## Rules/Steering

AI Assistants usually support rule files to provide guidance on their use (see [Rule File](#rule-file) for configuration information).

If you are using this MCP server in a hybrid setup alongside the SaaS MCP server and/or you have multiple managed environments, it is recommended to add this to your configuration to prevent the AI Assistant from using the wrong MCP or getting confused.

Your steering rules will be unique to your setup, but some recommended templates are included below as a starting point.
You can edit these as you see fit and include additional context that is specific to your environments.

### Example Rule File:

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

### Multiple Managed Environments

In this example, you have multiple Dynatrace Managed environments set up. This might be a development/test/production setup, or a set of entirely different applications. It is recommended to refer to your environments by the same alias you used in the `DT_ENVIRONMENT_CONFIGS` `alias` field to prevent confusion.

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
