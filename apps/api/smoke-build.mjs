import assert from 'node:assert/strict';
import { once } from 'node:events';
import console from 'node:console';

// Execute with plain Node (no tsx loader) to match the deployed module resolver.
const { default: app } = await import('./api/index.mjs');
assert.equal(typeof app, 'function');
const server = app.listen(0, '127.0.0.1');
try {
  await once(server, 'listening');
  const response = await globalThis.fetch(`http://127.0.0.1:${server.address().port}/`, {
    signal: globalThis.AbortSignal.timeout(3000),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).message, 'Megha API is up');
  console.log('Compiled API imports and serves HTTP successfully with plain Node.');
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
