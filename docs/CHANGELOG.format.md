# CHANGELOG format

This document defines how should CHANGELOG.md file and release notes be structured with versions released **after 1.0.1**.

## Overall structure

- Header 1 is reserved for project's name at the top
- Header 2 is to be used when defining a release (including unreleased)
- Header 3 is to be used for `change type` header

## Change type headers

When constructing changelog your changes should fall into one of these categories:

- **Breaking changes**

  When updating the application user might have to change configuration depending on what was changed. Every instance of breaking changes MUST mean incrementing major version

- **Security**

  Fixed vulnerabilities, all kinds of hardening concerning code or pipelines. May overlap with **Fixes** or **Changes**

- **Features**

  This section contains new functionalities

- **Fixes**

  This section contains bugfixes

- **Changes**

  Changes in behaviour that are neither a new feature nor a bugfix

- **Dependencies**

  Contains a `table` of dependency version changes

- **Documentation**

  This section contains information about changes to all kinds of documentation

Headers keep the same order\
Don't type out header if there are 0 changes which fall under given category

## Dependencies table

Since there may be many dependency updates in given release it has been decided to display them in a table with following format:

| Type   | Name                      | Old    | New    |
| ------ | ------------------------- | ------ | ------ |
| ci     | docker/login-action       | 4.5.2  | 4.6.0  |
| deps   | fast-uri                  | 3.1.4  | 3.1.5  |
| deps   | ip-address                | 10.2.0 | 10.4.0 |
| deps   | @modelcontextprotocol/sdk | 1.29.0 | 1.30.0 |
| docker | node                      | 26.3.1 | 26.5.1 |
| engine | node                      | None   | 26.5.1 |

Where `type` column may be of one of following values:

- ci - workflow files
- deps - node libraries
- deps-dev - node development libraries
- docker - Dockerfile
- engine - `engine` property of `package.json` file

## Contributors

If given change was done by external contributor make sure to mention them if following fashion:

```markdown
// Example

### Fixes

- Fixed status filter not being applied in `list_problems` tool by @jasssonpet in #236
```
