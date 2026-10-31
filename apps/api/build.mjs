import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

// Vercel's Other preset requires a static output directory even for an API-only
// project. Keep it empty: the backend bundle must never be published as an asset.
await mkdir(new URL('./public/', import.meta.url), { recursive: true });

// Compile application and shared workspace TypeScript together. Keep installed
// npm dependencies external so their own exports and runtime assets are preserved.
await build({
  absWorkingDir: root,
  entryPoints: ['src/app.ts'],
  outfile: 'dist/app.mjs',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  external: Object.keys(manifest.dependencies).filter((name) => !name.startsWith('@megha/')),
  logLevel: 'info',
});
