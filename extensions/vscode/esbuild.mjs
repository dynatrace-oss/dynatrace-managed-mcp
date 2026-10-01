import { build, context } from 'esbuild';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const watch = process.argv.includes('--watch');

function copyIcon() {
  const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8'));
  const source = path.resolve(HERE, manifest.iconSource);

  if (!fs.existsSync(source)) {
    throw new Error(`Marketplace icon is missing: ${path.relative(REPO_ROOT, source)}`);
  }

  fs.copyFileSync(source, path.join(HERE, manifest.icon));
}

const EXTENSION_HOST_TARGET = 'node20';

const extensionBuild = {
  entryPoints: [path.join(HERE, 'src', 'extension.ts')],
  outfile: path.join(HERE, 'dist', 'extension.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: EXTENSION_HOST_TARGET,
  external: ['vscode'],
  sourcemap: true,
  minify: !watch,
  logLevel: 'info',
};

const serverBuild = {
  entryPoints: [path.join(REPO_ROOT, 'src', 'index.ts')],
  outfile: path.join(HERE, 'dist', 'mcp', 'server.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: EXTENSION_HOST_TARGET,
  sourcemap: true,
  minify: !watch,
  logLevel: 'info',
  absWorkingDir: REPO_ROOT,
};

copyIcon();

if (watch) {
  const contexts = await Promise.all([context(extensionBuild), context(serverBuild)]);
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('esbuild is watching for changes...');
} else {
  await Promise.all([build(extensionBuild), build(serverBuild)]);
}
