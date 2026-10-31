import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import app from '../apps/api/api/index';

test('serverless entry serves root liveness without a database connection', async () => {
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/`, {
      signal: AbortSignal.timeout(2000),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      message: 'Megha API is up',
      status: 'ok',
      health: '/api/v1/health',
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
