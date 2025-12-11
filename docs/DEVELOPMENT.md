# Development

This file is intended for contributors/developers of the dynatrace-managed-mcp package.

## Local Development

For local development purposes, you can use your favourite IDE and AI coding assistant.
You can test with any AI Assistant(s) that support MCPs.

### Setup Commands

This is standard TypeScript project. We assume that you have preinstalled tools like `npm`, `node`, etc.

To get started, run:

```bash
npm install
npm run buld
npm run test
```

### Logs

Strongly recommend setting `LOG_LEVEL=debug` for all development and local testing.

View the `dynatrace-managed-mcp.log` file in the current working directory to see logs of tool execution,
API responses, and the response text returned by the MCP tool. Also check the log file for errors.

### Integration Tests

Integration tests run against a real Dynatrace Managed environment, making real API calls.
It is assumed that this environment has sufficient data to be able to sensibly test the API
calls and processing of responses.

Configure the `.env` file with the URL and [an API token with the required scopes](../README.md#api-scopes-for-managed-deployment). See `.env.template` as a starting point.
See [main README](../README.md#environment-variables) for description of Environment Variables.

Some useful example testing commands:

```bash
npm run test:unit
npm run test:integration
npm run test -- test/integration/capabilities.integration.test.ts
```

### Test Coverage

You can generate a test coverage report by running: `npm run coverage`.

This produces a report in `coverage/lcov-report/index.html` showing the extent of code coverage by the tests, and what code is not covered.

(Do not check the report into the repo as it will quickly become stale; it is in `.gitignore`).

### Running the MCP Server

You can run the MCP Server directly with the command below:

```bash
node --env-file=.env ./dist/index.js
```

or:

```bash
node --env-file=.env ./dist/index.js --http
```

This can be useful to test that nothing is seriously broken. However, it is impractical to interact directly with
the MCP Server in this way. Instead, see the [MCP Inspector](#mcp-inspector) section below.

### MCP Inspector

Use the MCP Inspector to manually check the MCP is valid, is offering the right tools, and that you can call them.

Run the command below. It will open a browser tab allowing you to connect, to browse the tools etc, and to invoke
the tools:

```bash
npm run build; npx @modelcontextprotocol/inspector node --env-file=.env ./dist/index.js
```

### MCP Testing from AI Assistant

Configure your preferred AI Assistant with an mcp.json file like that below:

```json
{
  "mcpServers": {
    "dynatrace-managed-mcp-server": {
      "command": "npx",
      "args": ["--watch", "/path/to/repos/dynatrace-oss/dynatrace-manage-mcp/dist/index.js"],
      "env": {
        "DT_MANAGED_ENVIRONMENT": "https://yourdomain.com:9999/e/01234546-789a-bcde-f012-3456789abcde",
        "DT_MANAGED_API_TOKEN": "dt0123.ABCDEFGHIJKLMNOPQRSTUVWX.YZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOP",
        "DT_MCP_DISABLE_TELEMETRY": "true",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

Note that VS Code supports `envFile`, so you can configure your project's `.vscode/mcp.json` with:

```json
{
  "servers": {
    "dynatrace-managed-mcp-server": {
      "command": "node",
      "args": ["--watch", "${workspaceFolder}/dist/index.js"],
      "envFile": "${workspaceFolder}/.env"
    }
  }
}
```

Tips:

- Ensure that `dist/index.js` is executable (e.g. `chmod u+x dist/index.js`).
- Test execution of the MCP, e.g. `npx /path/to/repos/dynatrace-oss/dynatrace-manage-mcp/dist/index.js`
  (you'll also have to set the environment variables first.)
- Check the log file `dynatrace-managed-mcp.log`, written to the current working directory.

### Docker

You can build the Docker container locally, for example:

```bash
docker build docker build . -t mcp/dynatrace-managed-mcp-server:snapshot
```

You can then use that locally, for example with the following in your `mcp.json`:

```json
{
  "mcpServers": {
    "dynatrace-managed-mcp-server-docker": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e",
        "DT_MANAGED_ENVIRONMENT",
        "-e",
        "DT_MANAGED_API_TOKEN",
        "-e",
        "DT_MCP_DISABLE_TELEMETRY",
        "-e",
        "LOG_LEVEL",
        "mcp/dynatrace-managed-mcp-server:snapshot"
      ],
      "env": {
        "DT_MANAGED_ENVIRONMENT": "https://yourdomain.com:9999/e/01234546-789a-bcde-f012-3456789abcde",
        "DT_MANAGED_API_TOKEN": "dt0123.ABCDEFGHIJKLMNOPQRSTUVWX.YZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOP",
        "DT_MCP_DISABLE_TELEMETRY": "true",
        "LOG_LEVEL": "debug"
      },
      "transport": "stdio",
      "disabled": false
    }
  }
}
```

### Enable Coding Assistant

For example, enable Copilot for your Workspace `.vscode/settings.json`:

```json
{
  "github.copilot.enable": {
    "*": true
  }
}
```

and make sure that you are using Agent Mode in Copilot.

## Development Troubleshooting

### Mcp error: -32002: connection closed: initialize response

The error below can occur when there is an error invoking the MCP:

    `Mcp error: -32002: connection closed: initialize response`

Check that you can execute the MCP, as per your configuration for local testing, e,g, with:

    `npx /path/to/repos/dynatrace-oss/dynatrace-manage-mcp/dist/index.js`

### MCP tool execution fails with 'Transport closed'

When using the stdio transport, it is very sensitive to any extra stdout that is written: all stdout is interpreted
as part of the response, and can thus make the request fail from the caller's perspective.

1.  Make sure there is no use of `console.log`, or any console output from 3rd party libraries.
2.  Use the [MCP Inspector](#mcp-inspector) to try calling the tool (the error reporting from this can be much easier
    to use than digging out the internal logs of your chosen LLM). For example:
    `bun run build; bunx dotenv -- bunx @modelcontextprotocol/inspector bun ./dist/index.js`

## Releasing

When you are preparing for a release, you can use GitHub Copilot to guide you through the preparations.

In Visual Studio Code, you can use `/release` in the chat with Copilot in Agent Mode, which will execute [release.prompt.md](../.github/prompts/release.prompt.md).

You may include additional information such as the version number. If not specified, you will be asked.

This will:

- prepare the [changelog](../CHANGELOG.md),
- update the version number in [package.json](../package.json),
- commit the changes.

## Design Decisions

#### Processing API Responses

The MCP calls the Dynatrace Managed API, getting back JSON responses. There is no Dynatrace SDK library available to use, as the SDK is for SaaS environments.

The following approach is taken for processing API responses.

**When processing lists**;

- Define strongly typed response objects. However, declare all fields as optional.
  We thus code defensively and limit the assumptions made about what will be in the API responses.
- Extract pertinent information from these objects, and format as strings for the LLM.
  This helps the LLM to better parse the tool's response.
  (LLMs are bad at processing complex JSON: e.g. see https://arxiv.org/html/2510.15955v1, 'How Good Are LLMs at Processing Tool Outputs?', 2025, Kate, Rizk et al.)

**When processing details (e.g. `get_problem_details)**;

- Keep the raw JSON response.
- Format this with JSON.stringify, but top and tail the response: to tell the LLM to expect JSON, what the JSON is about, and then recommended next steps.
- Benefits of this approach:
  - Don't lose any data (e.g. in get_detailed_problems, there can be critical information several layers deep in the json).
  - Different users could have different data returned (e.g. depending upon how Davis is configured). Don't lose that information.
  - Empirically, we see this approach works well - primarily because all the details are about one thing (e.g. one problem) so it
    is less likely to get confused by the structure.

#### Formatting Responses

Each tool calls the capability client to make the API call and also to format the response as a nice string, to return
to the LLM (e.g. `problemsClient.listProblems()` and `problemsClient.formatList()`).

The alternative would be to have the formatting code in index.ts.

Our approach has the following benefits:

- The formatter methods can be unit and integration tested - including for scenarios where we receive sparse data etc.
- The index.ts file is already huge. Delegate to 'capabilities'.
- Formatting lives next to the API call, and next to the definition of the types it uses.

#### "Next Steps" Recommendations

Including 'Next Steps' in the tool responses can be very beneficial for the user. It helps the LLM to suggest to the user
what to do next, and also helps the LLM to better interpret the user's next instruction.

Expectation is that the LLM will include the user in the decision process of what to do next (we don't want or expect the
LLM to chain together tool calls without feeding back to the user or seeking guidance from the user - unless the user's
instructions demanded that).

Some guiding principles:

- Recommend that the user looks at the Dynatrace UI, giving as specific a URL as we can. For example, the Dynatrace UI for
  showing a problem is going to be better than the LLM's textual representation.
- Suggest ways to use that tool better, and tailor that based on the results (e.g. if list_problems returned no results
  then suggest to change the filters; or if it found more results than could be returned then suggest to use more specific
  filters).
- Suggest which tool to use next, where we can. For example, after list_problems, then suggest get_problem_details for if the
  user is interested in a specific problem.

#### MCP Tool Names

Testing with Kiro showed problems when both Dynatrace SaaS MCP and Dynatrace Managed MCP were configured
and used at the same time, when they both had the same tool names.

We therefore give the Dynatrace Managed MCP different names (by prefixing `dynatrace_managed_`).

Note that we originally intended to use names like 'dynatrace_managed/get_environment_info', but newer
versions of `@modelcontextprotocol/sdk` show a warning if the forward slash ('/') character is used in
a tool name.

#### MCP Resources

MCP Resources would be a great thing to include and use, to return more detailed Dynatrace documentation about specific features.
For example, there are lots of docs and examples on entitySelector usage, more than can be included in the tool's parameter description.

However, support for using MCP Resources is not great. For example, with Amazon Q CLI (now Kiro CLI), the following issues show that
it is not supported:

- https://github.com/aws/amazon-q-developer-cli/issues/1462
- https://github.com/aws/amazon-q-developer-cli/issues/2541

We therefore do not rely on MCP Resources as the mechanism to give details about how to use the MCP tools.

#### MCP Metadata

There are various places for the MCP provides to give details to the LLM about its capabilities, and guidance for how it's used.
It is important that all of these are used well:

- **MCP instructions**: an overview of the MCP, what it is for and how to use it. Also give an opportunity to give more wide-reaching
  information (e.g. 'entitySelector' is used by many different tools, so additional info can be given here).
- **List of tools**: ensure the tools are clearly named and described.
- **Tool description**: clear description of the tool itself, and for each of its parameters. Ensure examples are given for parameter
  values, and the right specific technical terms are used that will allow the LLM to make use of its existing knowledge.

#### Error handling

Errors are caught by the tool helper method in index.ts, and are returned to the user.

We do not attempt to catch and explain errors (e.g. in the capabilities code) because it is hard to get that right
without risking losing information. For example, a 400 response may be due to the LLM using the wrong entityId but
there could be other reasons. We trust the Dynatrace API to return us meaningful errors, and for the LLM to interpret
them in the context of what it asked the tool to do.

#### Logging & stderr

The `winston` standard logging framework is used (see `/src/utils/logger.ts`).

Include `log.debug` output for what the MCP is doing. This is vital during development, to help understand why the LLM responded
the way it did (otherwise the LLM hides far too much from us by doing its best to return something plausible).

Verbose debug logging includes:

- Log the MCP tool call, including the parameters.
- Log the API call, including the full JSON response.
- Log the full text returned by the tool to the LLM.

There is minimal use of `console.error()` (note this writes to stderr, so does not interfere with the stdio transport).
We write a single startup message, to give the user some feedback that it has started. But that's it. Instead, rely
on logging (especially because the stderr output is not seen by anyone when an LLM connects to the MCP via stdio).

#### Testing with Different LLMs

Different LLMs behave very differently, for how they use the MCP and how they present data back to the user.

Some LLMs will be very conservative, only doing exactly what the user said and giving the user data very similar to what the MCP returned.
Other LLMs will be more 'creative', guessing at different ways to use the MCP to answer the user's questions.

Manual testing must ensure that the MCP can be used by multiple LLMs, and that the instructions/metadata about the MCP is not
overly tailored to one LLM.

However, the manual testng is not to 'test the LLM'. For example, if the MCP specifies instructions that it 'must' do something but the
LLM ignores it, that is not something for the LLM developer to solve (just ensure that we really have said 'must', and we don't
have any contradictory instructions).

Saying that, some general tips, guidance and examples for a better user experience are captured in the README. These can and should be
added to.
