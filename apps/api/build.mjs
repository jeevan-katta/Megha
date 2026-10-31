import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

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
