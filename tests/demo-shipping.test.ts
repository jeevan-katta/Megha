import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DevelopmentShippingProvider } from '../apps/api/src/integrations/shiprocket/development-shipping.adapter';

test('demo shipping quotes integer paise and labels every booking as a demonstration', async () => {
  const provider = new DevelopmentShippingProvider('demo');
  const rates = await provider.deliveryOptions();
  assert.deepEqual(
    rates.map((r) => r.amount),
    [12000, 24000],
  );
  assert(rates.every((r) => r.label.includes('Demo') && r.label.includes('no dispatch')));
  const booking = await provider.createOrder();
  assert.match(booking.providerShipmentId, /^DEMO-SH-/);
  assert.match((await provider.assignAwb(booking.providerShipmentId)).awb, /^DEMOAWB/);
  assert.match(
    (await provider.generateLabel(booking.providerShipmentId)).labelUrl,
    /\/shipping-labels\/demo\//,
  );
  assert.match((await provider.schedulePickup()).reference, /^DEMO-PICKUP-/);
  assert.deepEqual((await provider.track()).updates, []);
  // Preserve the existing local provider contract.
  assert.match((await new DevelopmentShippingProvider().createOrder()).providerOrderId, /^DEV-SO-/);
});

test('hosted demo accepts test keys and rejects live or simulated payment configurations', () => {
  const cases = [
    { shipping: 'demo', payment: 'razorpay', key: 'rzp_test_example', allowed: true },
    { shipping: 'demo', payment: 'razorpay', key: 'rzp_live_example', allowed: false },
    { shipping: 'demo', payment: 'disabled', key: 'rzp_test_example', allowed: false },
    { shipping: 'demo', payment: 'development', key: 'rzp_test_example', allowed: false },
    { shipping: 'development', payment: 'razorpay', key: 'rzp_test_example', allowed: false },
  ];
  for (const entry of cases) {
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        "await import('./apps/api/src/config/env.ts')",
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          VERCEL: '1',
          APP_MODE: 'production',
          MONGODB_URI: 'mongodb+srv://example.invalid/demo',
          STORAGE_PROVIDER: 'disabled',
          EMAIL_PROVIDER: 'disabled',
          PAYMENT_PROVIDER: entry.payment,
          SHIPPING_PROVIDER: entry.shipping,
          RAZORPAY_KEY_ID: entry.key,
          RAZORPAY_KEY_SECRET: 'test-only-placeholder',
        },
      },
    );
    assert.ifError(result.error);
    assert.equal(
      result.status === 0,
      entry.allowed,
      entry.shipping + '/' + entry.payment + '/' + entry.key,
    );
  }
});
