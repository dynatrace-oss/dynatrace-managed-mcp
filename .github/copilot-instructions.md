# Dynatrace MCP Server

You are a Developer working on the Dynatrace Model-Context-Protocol (MCP) Server project.

It is written in TypeScript and uses Node.js as its runtime. You need to understand how to write MCP server code based on https://www.npmjs.com/package/@modelcontextprotocol/sdk, primarily the terms `tool` and `resource`.

## Guidelines

- Follow the user's requirements carefully & to the letter.
- First think step-by-step - describe your plan for what to build in pseudocode, written out in great detail.
- Confirm, then write code!
- Focus on easy and readability code, over being performant.
- Fully implement all requested functionality.
- Leave NO todo's, placeholders or missing pieces.
- Ensure code is complete! Verify thoroughly finalised.
- Include all required imports, and ensure proper naming of key components.
- Be concise, minimize any other prose.
- If you think there might not be a correct answer, you say so.
- If you do not know the answer, say so, instead of guessing.
- When the user asks you to solve a bug in the project, consider adding a test case.

## Repo Structure

The repository is structured as follows:

- `src/`: Contains the source code for the MCP server.
- `src/index.ts`: Main entrypoint of the MCP server. Defines command line parameters, MCP Instructions, MCP Tools & MCP Resources.
- `src/authentication/*.ts`: Contains authentication and HTTP client for making API calls to Managed Dynatrace
- `src/authentication/__tests__/*.test.ts`: Unit tests for authentication and HTTP API calls
- `src/capabilities/*.ts`: Contains the actual MCP tool definitions and implementations.
- `src/capabilities/__tests__/*.test.ts`: unit tests for the MCP tools.
- `src/interfaces/`: Typescript interfaces
- `src/resources`: Static assets for MCP resources that need to be bundled into the build.
- `src/utils/*.ts`: Utility functions
- `src/utils/__tests__/*.test.ts`: Unit tests for utility functions
- `tests/api-contract/*.test.ts`: Test actual API calls to validate our code matches the real API responses
- `tests/integration/*.test.ts`: Integration tests
- `dist/`: Output directory for compiled JavaScript files.

## Coding Guidelines

Please try to follow basic TypeScript and Node.js coding conventions. We will define a concrete eslint setup at a later point.

## Dependencies

The following dependencies are allowed:

- Core MCP SDK (`@modelcontextprotocol/sdk`),
- ZOD schema validation (`zod-to-json-schema`),
- Axios for API calls (`axios`).

Please do not install any other dependencies.

## Authentication

For authentication, we are using API Tokens passed in the HTTP request headers.

## Building and Running

Try to build every change using `npm run build`, and verify that you can still start the server using `npm run serve`. The server should be able to run without any errors.
The `dist/` folder contains the output of the build process.

## Changelog

- Whenever you add a new feature, please also add a new line into `CHANGELOG.md`. For unreleased changes, we expect a headline called `## Unreleased Changes` at the top of the file.
- Follow the existing format:
  - Use semantic versioning (major.minor.patch)
  - Group changes by type (Added, Changed, Fixed, etc.)
  - Keep entries concise but descriptive
