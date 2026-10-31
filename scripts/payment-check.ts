import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import mongoose from 'mongoose';
import type { AddressInfo } from 'node:net';
const database = 'megha_payment_check_' + randomUUID().replaceAll('-', '');
Object.assign(process.env, {
  MONGODB_URI: 'mongodb://127.0.0.1:27018/' + database + '?replicaSet=megha',
  APP_MODE: 'development',
  PAYMENT_PROVIDER: 'razorpay',
  ENABLE_CHECKOUT: 'true',
  EMAIL_PROVIDER: 'disabled',
  PINCODE_LOOKUP: 'disabled',
  RAZORPAY_KEY_ID: 'rzp_test_fixture',
  RAZORPAY_KEY_SECRET: 'fixture-secret',
  RAZORPAY_WEBHOOK_SECRET: 'fixture-webhook-secret',
  CRON_SECRET: 'fixture-cron-secret',
});
const { default: app } = await import('../apps/api/src/app');
const { connectDatabase } = await import('../apps/api/src/database/mongoose');
const { User } = await import('../apps/api/src/modules/users/user.model');
const { Product } = await import('../apps/api/src/modules/products/product.model');
const { Order } = await import('../apps/api/src/modules/orders/order.model');
const { createSession } = await import('../apps/api/src/modules/auth/session.service');
const { maintainReservations } = await import('../apps/api/src/jobs/reservations.job');
await connectDatabase();
await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
const nativeFetch = globalThis.fetch;
const providerOrders = new Map<string, number>();
let orderCounter = 0;
let paymentAmount = 0;
let captured = false;
/** Per-test override of what Razorpay reports for an order: no payments, or a payment status. */
let providerPayments: 'none' | 'authorized' | 'created' | 'failed' | '' = '';
let paymentAgeSeconds = 0;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (!url.startsWith('https://api.razorpay.com/')) return nativeFetch(input, init);
  if (url.endsWith('/orders') && init?.method === 'POST') {
    const body = JSON.parse(String(init.body));
    const id = 'order_fixture' + ++orderCounter;
    providerOrders.set(id, body.amount);
    return Response.json({ id });
  }
  const id = url.match(/\/orders\/([^/]+)\/payments$/)?.[1] ?? [...providerOrders.keys()].at(-1)!;
  const payment = {
    id: 'pay_fixture',
    order_id: id,
    amount: paymentAmount || providerOrders.get(id),
    currency: 'INR',
    status: providerPayments || (captured ? 'captured' : 'authorized'),
    created_at: Math.floor(Date.now() / 1000) - paymentAgeSeconds,
  };
  if (url.includes('/orders/') && url.endsWith('/payments'))
    return Response.json({ items: providerPayments === 'none' ? [] : [payment] });
  return Response.json(payment);
};
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/v1';
async function request(path: string, cookie: string, body: unknown) {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  return { status: response.status, ...(await response.json()) };
}
async function webhook(body: string, signature: string, eventId: string) {
  const response = await fetch(base + '/webhooks/razorpay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': eventId,
    },
    body,
  });
  return { status: response.status, ...(await response.json()) };
}
try {
  const user = await User.create({
    name: 'Payment Test',
    email: 'payments@check.example',
    role: 'CUSTOMER',
    active: true,
  });
  const cookie = 'megha_session=' + (await createSession(user._id));
  const other = await User.create({
    name: 'Other Customer',
    email: 'other@check.example',
    role: 'CUSTOMER',
    active: true,
  });
  const otherCookie = 'megha_session=' + (await createSession(other._id));
  const product = await Product.create({
    name: 'Test Part',
    sku: 'PAY-TEST',
    slug: 'payment-test',
    price: 10000,
    gstRate: 18,
    stock: 10,
    reserved: 0,
    active: true,
  });
  const checkout = {
    items: [{ productId: String(product._id), quantity: 1 }],
    idempotencyKey: randomUUID(),
    customer: { name: 'Payment Test', email: user.email, phone: '9999999999' },
    address: { line1: '1 Test Road', city: 'Hyderabad', state: 'Telangana', pincode: '500003' },
  };
  const order = await request('/orders', cookie, checkout);
  assert.equal(order.status, 201);
  const changed = await request('/orders', cookie, {
    ...checkout,
    items: [{ productId: String(product._id), quantity: 2 }],
  });
  assert.equal(changed.status, 409);
  const sessions = await Promise.all([
    request('/payments/order', cookie, { orderId: order.data._id }),
    request('/payments/order', cookie, { orderId: order.data._id }),
  ]);
  assert.ok(sessions.some((result) => result.status === 200));
  assert.equal(orderCounter, 1, 'Concurrent payment starts must not create two provider orders');
  const providerOrder = sessions.find((result) => result.status === 200)!.data.providerOrderId;
  assert.equal(
    (await request('/payments/order', otherCookie, { orderId: order.data._id })).status,
    404,
  );
  const signature = createHmac('sha256', 'fixture-secret')
    .update(providerOrder + '|pay_fixture')
    .digest('hex');
  const verification = {
    orderId: order.data._id,
    razorpay_payment_id: 'pay_fixture',
    razorpay_signature: signature,
  };
  assert.equal(
    (
      await request('/payments/razorpay/verify', cookie, {
        ...verification,
        razorpay_signature: '0'.repeat(64),
      })
    ).status,
    400,
  );
  assert.equal(
    (await request('/payments/razorpay/verify', cookie, verification)).status,
    409,
    'Authorization alone is not captured payment',
  );
  captured = true;
  paymentAmount = 1;
  assert.equal(
    (await request('/payments/razorpay/verify', cookie, verification)).status,
    409,
    'Amount mismatch must fail',
  );
  assert.equal((await Product.findById(product._id))?.stock, 10);
  paymentAmount = order.data.total;
  const raw = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_fixture',
          order_id: providerOrder,
          amount: order.data.total,
          currency: 'INR',
          status: 'captured',
        },
      },
    },
  });
  const webhookSignature = createHmac('sha256', 'fixture-webhook-secret').update(raw).digest('hex');
  assert.equal(
    (await webhook(raw + ' ', webhookSignature, 'event_fixture')).status,
    401,
    'Verify exact raw bytes',
  );
  const concurrent = await Promise.all([
    webhook(raw, webhookSignature, 'event_fixture'),
    request('/payments/razorpay/verify', cookie, verification),
  ]);
  for (const result of concurrent) assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal((await webhook(raw, webhookSignature, 'event_fixture')).data.duplicate, true);
  assert.equal((await Product.findById(product._id))?.stock, 9);
  assert.equal((await Product.findById(product._id))?.reserved, 0);
  assert.equal((await Order.findById(order.data._id))?.paymentStatus, 'CAPTURED');
  assert.equal(
    (await request('/payments/reconcile', cookie, { orderId: order.data._id })).status,
    200,
  );
  assert.equal((await Product.findById(product._id))?.stock, 9);

  // Reservation expiry: unpaid orders cancel themselves and release stock.
  paymentAmount = 0;
  const reservedNow = async () => (await Product.findById(product._id))?.reserved;
  const placeOrder = async () => {
    const placed = await request('/orders', cookie, { ...checkout, idempotencyKey: randomUUID() });
    assert.equal(placed.status, 201);
    return placed.data._id as string;
  };
  const expire = (id: string, minutesAgo: number) =>
    Order.updateOne({ _id: id }, { reservationExpires: new Date(Date.now() - minutesAgo * 60000) });
  const statusOf = async (id: string) => (await Order.findById(id))?.status;

  const unpaid = await placeOrder();
  assert.equal(await reservedNow(), 1);
  await expire(unpaid, 1);
  await maintainReservations({}, { providerRecheckMs: 0 });
  assert.equal(await statusOf(unpaid), 'CANCELLED', 'Expired order without payment cancels');
  assert.equal(await reservedNow(), 0, 'Cancelling releases reserved stock');

  const started = await placeOrder();
  assert.equal((await request('/payments/order', cookie, { orderId: started })).status, 200);
  providerPayments = 'none';
  await expire(started, 5);
  await maintainReservations({}, { providerRecheckMs: 0 });
  assert.equal(await statusOf(started), 'PENDING_PAYMENT', 'Razorpay orders get a grace period');
  await expire(started, 20);
  providerPayments = 'authorized';
  await maintainReservations({}, { providerRecheckMs: 0 });
  assert.equal(await statusOf(started), 'PENDING_PAYMENT', 'In-flight payment is never cancelled');
  providerPayments = 'created';
  paymentAgeSeconds = 60;
  await maintainReservations({}, { providerRecheckMs: 0 });
  assert.equal(await statusOf(started), 'PENDING_PAYMENT', 'A just-opened checkout is still live');
  paymentAgeSeconds = 3600;
  await maintainReservations({}, { providerRecheckMs: 0 });
  assert.equal(await statusOf(started), 'CANCELLED', 'Abandoned Razorpay checkout cancels');
  assert.equal(await reservedNow(), 0);

  providerPayments = '';
  captured = true;
  const lateOrder = (await Order.findById(started))!;
  const lateRaw = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_late',
          order_id: lateOrder.providerOrderId,
          amount: lateOrder.total,
          currency: 'INR',
          status: 'captured',
        },
      },
    },
  });
  const lateSignature = createHmac('sha256', 'fixture-webhook-secret')
    .update(lateRaw)
    .digest('hex');
  assert.equal((await webhook(lateRaw, lateSignature, 'event_late')).status, 200);
  const refunded = await Order.findById(started);
  assert.equal(refunded?.status, 'CANCELLED');
  assert.equal(refunded?.paymentStatus, 'REFUND_REQUIRED', 'Late payment is flagged for refund');
  assert.equal((await Product.findById(product._id))?.stock, 9, 'Late payment takes no stock');

  const viewed = await placeOrder();
  await expire(viewed, 1);
  const read = await fetch(base + '/orders/' + viewed, { headers: { Cookie: cookie } });
  assert.equal((await read.json()).data.status, 'CANCELLED', 'Opening an expired order cancels it');

  assert.equal((await fetch(base + '/jobs/reservations')).status, 401);
  const cron = await fetch(base + '/jobs/reservations', {
    headers: { Authorization: 'Bearer fixture-cron-secret' },
  });
  assert.equal(cron.status, 200, 'Scheduler GET (Vercel Cron) is accepted with the secret');
  console.log(
    'Payment checks passed using a mocked Razorpay transport: idempotency, ownership, capture verification, wrong amounts, raw webhook authentication, concurrent callback/webhook, reconciliation and reservation expiry (grace period, in-flight payments, late-payment refunds, on-read expiry, scheduler).',
  );
} finally {
  globalThis.fetch = nativeFetch;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  assert.equal(mongoose.connection.name, database);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
