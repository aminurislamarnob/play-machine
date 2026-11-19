import { build, context } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const watchMode = process.argv.includes('--watch');

const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
  alias: {
    '@shared': path.join(rootDir, 'shared'),
  },
};

const mainConfig = {
  ...commonOptions,
  entryPoints: [path.join(rootDir, 'electron/main.ts')],
  outfile: path.join(rootDir, 'dist-electron/main.js'),
  format: 'cjs',
};

const preloadConfig = {
  ...commonOptions,
  entryPoints: [path.join(rootDir, 'electron/preload.ts')],
  outfile: path.join(rootDir, 'dist-electron/preload.cjs'),
  format: 'cjs',
};

if (watchMode) {
  const [mainCtx, preloadCtx] = await Promise.all([
    context(mainConfig),
    context(preloadConfig),
  ]);
  await Promise.all([mainCtx.watch(), preloadCtx.watch()]);
  console.log('[electron] Watching main & preload...');
} else {
  await Promise.all([build(mainConfig), build(preloadConfig)]);
}
