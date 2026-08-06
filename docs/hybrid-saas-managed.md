# Running alongside the Dynatrace SaaS MCP

This Dynatrace Managed MCP server can be run alongside the SaaS Dynatrace MCP to enable a hybrid setup between your self-hosted and SaaS Dynatrace environments. This is useful if you run your applications in a genuinely hybrid fashion, but it also covers migration scenarios where you've moved to Dynatrace SaaS but still have historical data on your Managed platform that won't be migrated. In this scenario, your MCP client can be configured to talk to both MCP servers simultaneously, enabling you to query across SaaS and Managed data.

## Setting it up

1. Set up this Dynatrace Managed MCP server — see [Set up local (stdio) mode](setup-local.md) or [Set up remote (HTTP) mode](setup-remote.md).
2. Set up the [Dynatrace SaaS MCP](https://github.com/dynatrace-oss/dynatrace-mcp) server, making sure to name the two servers **differently** in your MCP client configuration.
3. In your AI client, confirm that it is connected to both. If it isn't, see [Troubleshooting](troubleshooting.md).
4. (Optional, but recommended) Set up rules or steering for your AI client to give it clear guidance on using both MCPs — see the templates below.

Once you have both MCP servers configured, you can ask questions that your MCP client should pass back to the right MCP server (or to both, where appropriate).

## Why steering matters

Without rules, a query such as `Ask Dynatrace to list application problems from the last 24 hours` might use one MCP server or both, depending on what's in your context window. Either be very specific in the prompt — e.g. `Ask Dynatrace to list application problems from the last 24 hours in my Managed environment` — or add rules or steering.

Your steering rules will be unique to your setup, but some recommended templates are included below as a starting point. You can edit these as you see fit and include additional context that is specific to your environments.

## Steering: after a migration

In this example, you have migrated from Managed to SaaS, but still have historic data in your self-hosted Managed environment. You want your AI assistant to have context on what data lives where. This will enable it to know which environments to target for the date range you ask for, e.g. `Show me all Dynatrace problems from the last 7 days` may require data from both environments (and thus use both MCP servers), or may all reside in just the Dynatrace SaaS.

```text
# Dynatrace

- I have two separate Dynatraces:
   1. Dynatrace Managed is self-hosted. It contains only historical data from before 29th November 2025.
      It is accessed via the Dynatrace Managed MCP, named dynatrace-managed-mcp-server
   2. Dynatrace SaaS is used for all live data.
      It is accessed through the Dynatrace SaaS MCP, named dynatrace-saas-mcp-server
- Be careful of which MCP to use.
  If it is unclear, ask which MCP to use.
- Must make it very clear to the user whether data has come from the Dynatrace Managed or Dynatrace SaaS.
```

## Steering: running in tandem

In this example, you use Dynatrace Managed for some of your applications and Dynatrace SaaS for others, and want your
MCP client to have context on where to find data for each one.

```text
# Dynatrace

- I have two separate Dynatraces, which both contain live data:
   1. Dynatrace Managed is self-hosted. It only contains observability data for some of my systems,
      primarily the bookstore systems.
      It is accessed via the Dynatrace Managed MCP, named dynatrace-managed-mcp-server
   2. Dynatrace SaaS is used for observability of all my other systems.
      It is accessed through the Dynatrace SaaS MCP, named dynatrace-saas-mcp-server
- Be careful of which MCP to use.
  If it is unclear, ask which MCP to use.
- Must make it very clear to the user whether data has come from the Dynatrace Managed or Dynatrace SaaS.
```

Rule files work per assistant, not per Dynatrace deployment — see [Rule files](multi-environment.md#rule-files) in the multi-environment guide for where they live and an example.
