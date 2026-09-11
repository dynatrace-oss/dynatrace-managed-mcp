const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AGENT_PLUGINS_SPEC_VERSION = '1.0.0';
const CLAUDE_PLUGIN_MANIFEST = '.claude-plugin/plugin.json';
const MARKETPLACE_MANIFEST = '.claude-plugin/marketplace.json';
const CLAUDE_MCP_MANIFEST = '.mcp.json';
const VSCODE_EXTENSION_DIR = 'extensions/vscode';
const VSCODE_EXTENSION_MANIFEST = `${VSCODE_EXTENSION_DIR}/package.json`;

function readJson(relativePath) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${relativePath}: ${error.message}`);
  }
}

function npxPackageSpec(server) {
  if (server.command !== 'npx' || !Array.isArray(server.args)) {
    return undefined;
  }

  return server.args.find((arg) => !arg.startsWith('-'));
}

function splitPackageSpec(packageSpec) {
  const versionSeparator = packageSpec.lastIndexOf('@');
  return versionSeparator > 0
    ? { name: packageSpec.slice(0, versionSeparator), range: packageSpec.slice(versionSeparator + 1) }
    : { name: packageSpec, range: undefined };
}

function npmPackageFromNpxArgs(server) {
  const packageSpec = npxPackageSpec(server);
  return packageSpec === undefined ? undefined : splitPackageSpec(packageSpec).name;
}

function majorOf(version) {
  const match = /^(\d+)(?:[.-]|$)/.exec(String(version));
  return match ? Number(match[1]) : undefined;
}

function lockRootPackage(lock) {
  return (lock.packages || {})[''] || {};
}

function collectVersions(pkg, lock, serverManifest, pluginManifest, cursorManifest, claudeManifest, vscodeManifest) {
  const versions = [
    { source: 'package.json » version', value: pkg.version },
    { source: 'server.json » version', value: serverManifest.version },
    { source: 'plugin.json » version', value: pluginManifest.version },
    { source: '.cursor-plugin/plugin.json » version', value: cursorManifest.version },
    { source: `${CLAUDE_PLUGIN_MANIFEST} » version`, value: claudeManifest.version },
    { source: `${VSCODE_EXTENSION_MANIFEST} » version`, value: vscodeManifest.version },
    { source: 'package-lock.json » version', value: lock.version },
    { source: 'package-lock.json » packages[""].version', value: lockRootPackage(lock).version },
  ];

  (serverManifest.packages || []).forEach((entry, index) => {
    versions.push({ source: `server.json » packages[${index}].version`, value: entry.version });
  });

  return versions;
}

function collectPluginNames(pluginManifest, cursorManifest, claudeManifest) {
  return [
    { source: 'plugin.json » name', value: pluginManifest.name },
    { source: '.cursor-plugin/plugin.json » name', value: cursorManifest.name },
    { source: `${CLAUDE_PLUGIN_MANIFEST} » name`, value: claudeManifest.name },
  ];
}

function collectIdentifiers(pkg, lock, serverManifest, mcpManifests, vscodeManifest) {
  const identifiers = [
    { source: 'package.json » name', value: pkg.name },
    { source: 'package-lock.json » name', value: lock.name },
    { source: 'package-lock.json » packages[""].name', value: lockRootPackage(lock).name },
    {
      source: `${VSCODE_EXTENSION_MANIFEST} » dynatraceManagedMcpServer.npmPackage`,
      value: (vscodeManifest.dynatraceManagedMcpServer || {}).npmPackage,
    },
  ];

  (serverManifest.packages || []).forEach((entry, index) => {
    if (entry.registryType === 'npm') {
      identifiers.push({ source: `server.json » packages[${index}].identifier`, value: entry.identifier });
    }
  });

  mcpManifests.forEach(({ file, manifest }) => {
    Object.entries(manifest.mcpServers || {}).forEach(([serverName, server]) => {
      const identifier = npmPackageFromNpxArgs(server);
      if (identifier) {
        identifiers.push({ source: `${file} » mcpServers.${serverName}.args`, value: identifier });
      }
    });
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

function checkNpxMajorPins(pkg, mcpManifests) {
  const major = majorOf(pkg.version);

  if (major === undefined) {
    return [`package.json » version is ${JSON.stringify(pkg.version)}, which has no major version to pin against`];
  }

  const expectedRange = `<${major + 1}`;
  const errors = [];

  mcpManifests.forEach(({ file, manifest }) => {
    Object.entries(manifest.mcpServers || {}).forEach(([serverName, server]) => {
      const packageSpec = npxPackageSpec(server);
      if (packageSpec === undefined) {
        return;
      }

      const { name, range } = splitPackageSpec(packageSpec);
      if (name !== pkg.name) {
        return; // A third-party server is not ours to pin.
      }

      if (range === undefined) {
        errors.push(
          `${file} » mcpServers.${serverName}.args installs "${name}" with no version range - pin it to ` +
            `"${name}@${expectedRange}" so a breaking major is never picked up automatically`,
        );
        return;
      }

      if (range !== expectedRange) {
        errors.push(
          `${file} » mcpServers.${serverName}.args pins "${name}@${range}" but version ${pkg.version} requires ` +
            `"${name}@${expectedRange}". Widen the pin deliberately as part of the major release.`,
        );
      }
    });
  });

  return errors;
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

function checkCursorManifestPaths(cursorManifest) {
  const declaredPaths = { skills: cursorManifest.skills, mcpServers: cursorManifest.mcpServers };

  return Object.entries(declaredPaths)
    .filter(([, declared]) => declared && !fs.existsSync(path.join(REPO_ROOT, declared)))
    .map(([field, declared]) => `.cursor-plugin/plugin.json » ${field} points at "${declared}", which does not exist`);
}

function checkCursorVariablesAreWired(cursorManifest, mcpManifest) {
  const declared = Object.keys((cursorManifest.variables || {}).properties || {});
  const referenced = new Set();

  Object.values(mcpManifest.mcpServers || {}).forEach((server) => {
    Object.values(server.env || {}).forEach((value) => {
      const match = /^\$\{(.+)\}$/.exec(value);
      if (match) {
        referenced.add(match[1]);
      }
    });
  });

  const required = ((cursorManifest.variables || {}).required || []).filter((name) => !referenced.has(name));
  const orphaned = [...referenced].filter((name) => !declared.includes(name));

  return [
    ...required.map(
      (name) => `.cursor-plugin/plugin.json requires variable "${name}" but no mcp.json server env references it`,
    ),
    ...orphaned.map(
      (name) => `mcp.json references \${${name}} but .cursor-plugin/plugin.json declares no such variable`,
    ),
  ];
}

function checkClaudePluginPaths(claudeManifest) {
  const errors = [];
  const declaredSkills = claudeManifest.skills;

  if (!declaredSkills) {
    errors.push(`${CLAUDE_PLUGIN_MANIFEST} declares no skills path - the plugin would install without its skill`);
  } else if (!fs.existsSync(path.join(REPO_ROOT, declaredSkills))) {
    errors.push(`${CLAUDE_PLUGIN_MANIFEST} » skills points at "${declaredSkills}", which does not exist`);
  }

  if (!fs.existsSync(path.join(REPO_ROOT, CLAUDE_MCP_MANIFEST))) {
    errors.push(`${CLAUDE_MCP_MANIFEST} is missing - the plugin would install without its MCP server`);
  }

  if (claudeManifest.mcpServers !== undefined) {
    errors.push(
      `${CLAUDE_PLUGIN_MANIFEST} declares mcpServers inline, which Claude Code does not register as a ` +
        `component - move the servers to ${CLAUDE_MCP_MANIFEST}`,
    );
  }

  return errors;
}

function checkClaudeUserConfigIsWired(claudeManifest, claudeMcpManifest) {
  const declared = Object.keys(claudeManifest.userConfig || {});
  const referenced = new Set();

  Object.values(claudeMcpManifest.mcpServers || {}).forEach((server) => {
    Object.values(server.env || {}).forEach((value) => {
      const match = /^\$\{user_config\.(.+)\}$/.exec(value);
      if (match) {
        referenced.add(match[1]);
      }
    });
  });

  const unread = declared.filter((name) => !referenced.has(name));
  const orphaned = [...referenced].filter((name) => !declared.includes(name));

  return [
    ...unread.map(
      (name) =>
        `${CLAUDE_PLUGIN_MANIFEST} declares userConfig "${name}" but no ${CLAUDE_MCP_MANIFEST} server env ` +
        `references \${user_config.${name}}`,
    ),
    ...orphaned.map(
      (name) =>
        `${CLAUDE_MCP_MANIFEST} references \${user_config.${name}} but ${CLAUDE_PLUGIN_MANIFEST} declares no such ` +
        `userConfig option`,
    ),
  ];
}

function checkMarketplaceEntries(marketplace, claudeManifest) {
  const errors = [];

  (marketplace.plugins || []).forEach((entry, index) => {
    const at = `.claude-plugin/marketplace.json » plugins[${index}]`;

    if (typeof entry.source !== 'string') {
      return;
    }

    const manifestPath = `${entry.source.replace(/\/$/, '')}/.claude-plugin/plugin.json`;
    if (!fs.existsSync(path.join(REPO_ROOT, manifestPath))) {
      errors.push(`${at}.source is "${entry.source}", which has no ${manifestPath}`);
      return;
    }

    const sourced = readJson(manifestPath);
    if (entry.name !== sourced.name) {
      errors.push(
        `${at}.name is ${JSON.stringify(entry.name)} but ${manifestPath} » name is ` +
          `${JSON.stringify(sourced.name)} - keep them identical so installs and /plugin enable ` +
          `address the same plugin`,
      );
    }
  });

  const listed = (marketplace.plugins || []).some((entry) => entry.name === claudeManifest.name);
  if (!listed) {
    errors.push(
      `.claude-plugin/marketplace.json lists no plugin named "${claudeManifest.name}" - the Claude Code ` +
        `plugin would not be installable from this repository`,
    );
  }

  return errors;
}

function checkVsCodeExtension(pkg, vscodeManifest) {
  const errors = [];
  const at = VSCODE_EXTENSION_MANIFEST;
  const major = majorOf(pkg.version);

  const spec = vscodeManifest.dynatraceManagedMcpServer;
  if (spec === undefined) {
    errors.push(
      `${at} declares no dynatraceManagedMcpServer block - the "npx" runtime mode reads npmPackage ` +
        `and npmVersionRange from it and would launch "undefined@undefined"`,
    );
  } else if (major !== undefined && spec.npmVersionRange !== `<${major + 1}`) {
    errors.push(
      `${at} » dynatraceManagedMcpServer.npmVersionRange is ${JSON.stringify(spec.npmVersionRange)} but ` +
        `version ${pkg.version} requires "<${major + 1}". Widen the pin deliberately as part of the major release.`,
    );
  }

  if (!vscodeManifest.publisher) {
    errors.push(`${at} declares no publisher - vsce cannot publish the extension without one`);
  }

  if (!(vscodeManifest.engines || {}).vscode) {
    errors.push(`${at} declares no engines.vscode - the Marketplace cannot tell which VS Code versions are supported`);
  }

  if (vscodeManifest.main !== './dist/extension.js') {
    errors.push(
      `${at} » main is ${JSON.stringify(vscodeManifest.main)} but esbuild.mjs writes the bundle to ` +
        `"./dist/extension.js" - the extension would fail to activate`,
    );
  }

  const providers = (vscodeManifest.contributes || {}).mcpServerDefinitionProviders || [];
  if (providers.length === 0) {
    errors.push(
      `${at} contributes no mcpServerDefinitionProviders - the extension would install without ` +
        `registering an MCP server`,
    );
  } else {
    const source = path.join(REPO_ROOT, VSCODE_EXTENSION_DIR, 'src', 'extension.ts');
    const extensionSource = fs.existsSync(source) ? fs.readFileSync(source, 'utf8') : '';
    providers.forEach((provider, index) => {
      if (!provider.id) {
        errors.push(`${at} » contributes.mcpServerDefinitionProviders[${index}] declares no id`);
        return;
      }

      if (extensionSource && !extensionSource.includes(`'${provider.id}'`)) {
        errors.push(
          `${at} » contributes.mcpServerDefinitionProviders[${index}].id is ${JSON.stringify(provider.id)} but ` +
            `${VSCODE_EXTENSION_DIR}/src/extension.ts never references it - ` +
            `registerMcpServerDefinitionProvider would be called with an uncontributed id`,
        );
      }
    });
  }

  ['README.md', 'LICENSE'].forEach((file) => {
    if (!fs.existsSync(path.join(REPO_ROOT, VSCODE_EXTENSION_DIR, file))) {
      errors.push(`${VSCODE_EXTENSION_DIR}/${file} is missing - vsce packages it into the .vsix`);
    }
  });

  if (vscodeManifest.icon || vscodeManifest.iconSource) {
    errors.push(...checkMarketplaceIcon(vscodeManifest));
  }

  return errors;
}

function checkMarketplaceIcon(vscodeManifest) {
  const at = `${VSCODE_EXTENSION_DIR}/package.json`;

  if (!vscodeManifest.icon || !vscodeManifest.iconSource) {
    return [
      `${at} declares only one of icon and iconSource - esbuild.mjs copies iconSource to icon, so ` +
        `both are required`,
    ];
  }

  const relativeSource = path.posix.normalize(`${VSCODE_EXTENSION_DIR}/${vscodeManifest.iconSource}`);
  const source = path.join(REPO_ROOT, VSCODE_EXTENSION_DIR, vscodeManifest.iconSource);

  if (!fs.existsSync(source)) {
    return [`${at} » iconSource points at ${JSON.stringify(relativeSource)}, which does not exist`];
  }

  const header = fs.readFileSync(source);
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (header.length < 24 || !header.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return [`${relativeSource} is not a PNG file, but the Marketplace icon must be one`];
  }

  const width = header.readUInt32BE(16);
  const height = header.readUInt32BE(20);
  const errors = [];

  if (width < 128 || height < 128) {
    errors.push(
      `${relativeSource} is ${width}x${height}, but the Marketplace requires the extension icon to be at ` +
        `least 128x128. vsce packages a smaller icon without complaint and the upload is rejected instead, so ` +
        `supply a larger source image rather than upscaling this one.`,
    );
  }

  if (width !== height) {
    errors.push(`${relativeSource} is ${width}x${height}; the extension icon is rendered square`);
  }

  return errors;
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
  const lock = readJson('package-lock.json');
  const serverManifest = readJson('server.json');
  const pluginManifest = readJson('plugin.json');
  const cursorManifest = readJson('.cursor-plugin/plugin.json');
  const mcpManifest = readJson('mcp.json');
  const claudeManifest = readJson(CLAUDE_PLUGIN_MANIFEST);
  const claudeMcpManifest = readJson(CLAUDE_MCP_MANIFEST);
  const marketplace = readJson(MARKETPLACE_MANIFEST);
  const vscodeManifest = readJson(VSCODE_EXTENSION_MANIFEST);

  const mcpManifests = [
    { file: 'mcp.json', manifest: mcpManifest },
    { file: CLAUDE_MCP_MANIFEST, manifest: claudeMcpManifest },
  ];

  const errors = [
    ...findDisagreements(
      'Package version',
      collectVersions(pkg, lock, serverManifest, pluginManifest, cursorManifest, claudeManifest, vscodeManifest),
    ),
    ...findDisagreements(
      'Package identifier',
      collectIdentifiers(pkg, lock, serverManifest, mcpManifests, vscodeManifest),
    ),
    ...findDisagreements('Plugin name', collectPluginNames(pluginManifest, cursorManifest, claudeManifest)),
    ...findDisagreements('MCP registry name', [
      { source: 'package.json » mcpName', value: pkg.mcpName },
      { source: 'server.json » name', value: serverManifest.name },
    ]),
    ...checkNpxMajorPins(pkg, mcpManifests),
    ...checkAgentPluginsSchemas(pluginManifest, mcpManifest),
    ...checkCursorManifestPaths(cursorManifest),
    ...checkCursorVariablesAreWired(cursorManifest, mcpManifest),
    ...checkClaudePluginPaths(claudeManifest),
    ...checkClaudeUserConfigIsWired(claudeManifest, claudeMcpManifest),
    ...checkMarketplaceEntries(marketplace, claudeManifest),
    ...checkVsCodeExtension(pkg, vscodeManifest),
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
    console.error('A stale package-lock.json is fixed with `npm install --package-lock-only`.');
    process.exit(1);
  }

  const suffix = expectedVersion === undefined ? '' : ` (matching released version ${expectedVersion})`;
  console.log(
    `✅ Manifests agree: version ${pkg.version}, package ${pkg.name}, mcpName ${pkg.mcpName}, ` +
      `npx pin <${majorOf(pkg.version) + 1}${suffix}.`,
  );
}

// A missing or malformed manifest throws out of readJson before any check runs. Report it the same
// way as a failed check rather than dumping a stack trace into the CI log.
try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}\n`);
  console.error('Every manifest listed in RELEASE.md must exist and contain valid JSON.');
  process.exit(1);
}
