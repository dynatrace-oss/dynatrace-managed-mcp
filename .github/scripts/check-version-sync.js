const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AGENT_PLUGINS_SPEC_VERSION = '1.0.0';

function readJson(relativePath) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${relativePath}: ${error.message}`);
  }
}

function npmPackageFromNpxArgs(server) {
  if (server.command !== 'npx' || !Array.isArray(server.args)) {
    return undefined;
  }

  const packageSpec = server.args.find((arg) => !arg.startsWith('-'));
  if (!packageSpec) {
    return undefined;
  }

  const versionSeparator = packageSpec.lastIndexOf('@');
  return versionSeparator > 0 ? packageSpec.slice(0, versionSeparator) : packageSpec;
}

function collectVersions(pkg, serverManifest, pluginManifest) {
  const versions = [
    { source: 'package.json » version', value: pkg.version },
    { source: 'server.json » version', value: serverManifest.version },
    { source: 'plugin.json » version', value: pluginManifest.version },
  ];

  (serverManifest.packages || []).forEach((entry, index) => {
    versions.push({ source: `server.json » packages[${index}].version`, value: entry.version });
  });

  return versions;
}

function collectIdentifiers(pkg, serverManifest, mcpManifest) {
  const identifiers = [{ source: 'package.json » name', value: pkg.name }];

  (serverManifest.packages || []).forEach((entry, index) => {
    if (entry.registryType === 'npm') {
      identifiers.push({ source: `server.json » packages[${index}].identifier`, value: entry.identifier });
    }
  });

  Object.entries(mcpManifest.mcpServers || {}).forEach(([serverName, server]) => {
    const identifier = npmPackageFromNpxArgs(server);
    if (identifier) {
      identifiers.push({ source: `mcp.json » mcpServers.${serverName}.args`, value: identifier });
    }
  });

  return identifiers;
}

function findDisagreements(label, entries) {
  const [reference, ...rest] = entries;
  const mismatches = rest.filter((entry) => entry.value !== reference.value);

  if (mismatches.length === 0) {
    return [];
  }

  return [
    `${label} is out of sync - expected "${reference.value}" (from ${reference.source}):\n` +
      mismatches.map((entry) => `    ${entry.source} = ${JSON.stringify(entry.value)}`).join('\n'),
  ];
}

function checkAgentPluginsSchemas(pluginManifest, mcpManifest) {
  const expected = {
    'plugin.json': `https://agent-plugins.org/schemas/${AGENT_PLUGINS_SPEC_VERSION}/plugin.schema.json`,
    'mcp.json': `https://agent-plugins.org/schemas/${AGENT_PLUGINS_SPEC_VERSION}/mcp.schema.json`,
  };
  const actual = { 'plugin.json': pluginManifest.$schema, 'mcp.json': mcpManifest.$schema };

  return Object.entries(expected)
    .filter(([file, url]) => actual[file] !== url)
    .map(([file, url]) => `${file} » $schema must be "${url}" but is ${JSON.stringify(actual[file])}`);
}

function parseExpectedVersion(argv) {
  const flagIndex = argv.indexOf('--expect-version');
  if (flagIndex === -1) {
    return undefined;
  }

  const value = argv[flagIndex + 1];
  if (!value || value.startsWith('-')) {
    console.error('❌ --expect-version requires a value, e.g. --expect-version 1.2.0');
    process.exit(1);
  }

  return value;
}

function main() {
  const expectedVersion = parseExpectedVersion(process.argv.slice(2));
  const pkg = readJson('package.json');
  const serverManifest = readJson('server.json');
  const pluginManifest = readJson('plugin.json');
  const mcpManifest = readJson('mcp.json');

  const errors = [
    ...findDisagreements('Package version', collectVersions(pkg, serverManifest, pluginManifest)),
    ...findDisagreements('Package identifier', collectIdentifiers(pkg, serverManifest, mcpManifest)),
    ...findDisagreements('MCP registry name', [
      { source: 'package.json » mcpName', value: pkg.mcpName },
      { source: 'server.json » name', value: serverManifest.name },
    ]),
    ...checkAgentPluginsSchemas(pluginManifest, mcpManifest),
  ];

  if (expectedVersion !== undefined && pkg.version !== expectedVersion) {
    errors.push(
      `Released version "${expectedVersion}" does not match the manifests, which declare ` +
        `"${pkg.version}". Bump the manifests or retag.`,
    );
  }

  if (errors.length > 0) {
    console.error('❌ Manifests are inconsistent:\n');
    errors.forEach((error) => console.error(`  - ${error}\n`));
    console.error('Update every manifest listed in RELEASE.md before tagging.');
    process.exit(1);
  }

  const suffix = expectedVersion === undefined ? '' : ` (matching released version ${expectedVersion})`;
  console.log(`✅ Manifests agree: version ${pkg.version}, package ${pkg.name}, mcpName ${pkg.mcpName}${suffix}.`);
}

main();
