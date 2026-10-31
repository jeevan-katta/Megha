import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueryClient } from '../apps/frontend/src/lib/query-cache';
import { affectedByMutation } from '../apps/frontend/src/lib/query-invalidation';

test('read cache deduplicates requests, isolates users, and refreshes affected reads', async () => {
  const client = createQueryClient();
  let calls = 0;
  const key = ['private', 'alice', 'admin', 'products'];
  const queryFn = async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return calls;
  };
  try {
    await Promise.all([
      client.fetchQuery({ queryKey: key, queryFn }),
      client.fetchQuery({ queryKey: key, queryFn }),
    ]);
    await client.fetchQuery({ queryKey: key, queryFn });
    assert.equal(calls, 1);
    assert.equal(client.getQueryData(['private', 'bob', 'admin', 'products']), undefined);
    await client.invalidateQueries({
      predicate: (q) => affectedByMutation('/admin/inventory/123', q.queryKey),
    });
    await client.fetchQuery({ queryKey: key, queryFn });
    assert.equal(calls, 2);
    assert.equal(affectedByMutation('/checkout/validate', key), false);
    assert.equal(
      affectedByMutation('/admin/payments/123/reconcile', ['private', 'alice', 'admin', 'orders']),
      true,
    );
    assert.equal(
      affectedByMutation('/admin/products/123', ['private', 'alice', 'account', 'orders']),
      false,
    );
    assert.equal(affectedByMutation('/me/records/saved', key), false);
    assert.equal(affectedByMutation('/admin/service-requests/123', key), false);
    assert.equal(
      affectedByMutation('/me/records/saved', ['private', 'alice', 'account', 'records/saved']),
      true,
    );
    client.removeQueries({ queryKey: ['private'] });
    assert.equal(client.getQueryData(key), undefined);
  } finally {
    client.clear();
  }
});
