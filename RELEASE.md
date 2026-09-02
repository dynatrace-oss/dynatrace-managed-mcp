# Release Process

This repository uses automated GitHub workflows to prepare releases whenever a new tag is pushed.

## How it works

1. When you push a tag starting with `v` (e.g., `v1.0.0`, `v2.1.3`), the release workflow automatically triggers
2. The workflow builds the project, runs tests, and creates a GitHub release with release notes extracted from [CHANGELOG.md](CHANGELOG.md) file

## Version-bearing manifests

The npm package version is declared in four files, and they must all agree before tagging:

| File                | Field(s)                          |
| ------------------- | --------------------------------- |
| `package.json`      | `version`                         |
| `package-lock.json` | `version`, `packages[""].version` |
| `server.json`       | `version`, `packages[].version`   |
| `plugin.json`       | `version`                         |

`package-lock.json` is refreshed with `npm install --package-lock-only` after bumping
`package.json`. Note that `npm ci` succeeds against a stale root version and does not correct it, so
the lock file is only kept honest by this check.

`mcp.json` carries no version of its own - the Agent Plugins schema has no such field, and the `npx`
invocation is deliberately left unpinned so directory installs pick up the latest published release.
What it does carry is the npm package identifier, which must match `package.json`,
`package-lock.json` and `server.json` » `packages[].identifier`.

`npm run version:check` asserts all of the above. It runs on every pull request, again at the start of
the release workflow, and once more against the pushed tag - so a tag that disagrees with the
manifests fails before anything is published to npm, GHCR or the MCP Registry.

```bash
npm run version:check
```

## Creating a Release

### Manual tagging

```bash
# Make sure you're on the main branch and have latest changes
git checkout main
git pull origin main

# Run tests and build locally (optional but recommended)
npm test
npm run build

# Create and push a tag
git tag vx.y.z  # Replace with your desired version
git push origin vx.y.z
```

After pushing the tag, the workflow will automatically:

1. Run tests
2. Build the project
3. Generate release notes from [CHANGELOG.md](CHANGELOG.md) file
4. Create a GitHub release

### Creating Pre-releases

For beta or alpha releases:

```bash
# Create a pre-release tag
git tag vx.y.z-beta.1
git push origin vx.y.z-beta.1
```

Pre-releases will be automatically marked as such in the GitHub release.

## Release Notes

The workflow automatically generates technical release notes by collecting all commit messages between the current and previous tag. The release notes include:

- A list of changes extracted from [CHANGELOG.md](CHANGELOG.md) file
