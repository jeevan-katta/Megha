// End-to-end order lifecycle against an isolated database. Shiprocket and Razorpay are mocked at
// the network boundary; everything else (API, services, MongoDB transactions) is real.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import type { AddressInfo } from 'node:net';
const database = 'megha_fulfilment_check_' + randomUUID().replaceAll('-', '');
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
  SHIPPING_PROVIDER: 'shiprocket',
  SHIPROCKET_EMAIL: 'api@example.test',
  SHIPROCKET_PASSWORD: 'fixture-password',
  SHIPROCKET_PICKUP_LOCATION: 'Primary',
  SHIPROCKET_PICKUP_PINCODE: '500003',
  SHIPROCKET_WEBHOOK_TOKEN: 'fixture-tracking-token',
});
const { default: app } = await import('../apps/api/src/app');
const { connectDatabase } = await import('../apps/api/src/database/mongoose');
const { User } = await import('../apps/api/src/modules/users/user.model');
const { Product } = await import('../apps/api/src/modules/products/product.model');
const { Order } = await import('../apps/api/src/modules/orders/order.model');
const { Shipment, ShipmentEvent } =
  await import('../apps/api/src/modules/shipments/shipment.model');
const { Audit } = await import('../apps/api/src/modules/audit/audit.model');
const { Entity } = await import('../apps/api/src/modules/records/record.model');
const { Ledger } =
  await import('../apps/api/src/modules/inventory-transactions/inventory-transaction.model');
const { createSession } = await import('../apps/api/src/modules/auth/session.service');
await connectDatabase();
await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

// ---- Provider mocks -------------------------------------------------------------------------
const nativeFetch = globalThis.fetch;
const calls: Record<string, number> = {};
const failNext = new Set<string>();
const razorpayOrders = new Map<string, number>();
let shiprocketCounter = 0;
let refundCounter = 0;
let trackingScans: Record<string, string>[] = [];
const json = (body: unknown, status = 200) => Response.json(body, { status });
globalThis.fetch = async (input, init) => {
  const url = String(input);
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (url.startsWith('https://apiv2.shiprocket.in/v1/external/')) {
    const path = url.slice('https://apiv2.shiprocket.in/v1/external/'.length).split('?')[0];
    const name = path.replace(/\/[^/]*\d[^/]*$/, '').replace(/\/$/, '');
    calls[name] = (calls[name] ?? 0) + 1;
    if (failNext.delete(name)) return json({ message: 'Simulated ' + name + ' outage' }, 500);
    if (path === 'auth/login') return json({ token: 'fixture-token' });
    if (path === 'courier/serviceability/')
      return json({
        data: {
          available_courier_companies: [
            {
              courier_company_id: 10,
              courier_name: 'Surface Co',
              rate: 120.5,
              estimated_delivery_days: '5',
              etd: 'Oct 14, 2026',
              is_surface: true,
            },
            {
              courier_company_id: 20,
              courier_name: 'Air Co',
              rate: 240,
              estimated_delivery_days: 2,
              etd: 'Oct 11, 2026',
              is_surface: false,
            },
          ],
          recommended_courier_company_id: 10,
        },
      });
    if (path === 'orders/create/adhoc') {
      shiprocketCounter++;
      return json({
        order_id: 9000 + shiprocketCounter,
        shipment_id: 8000 + shiprocketCounter,
        status: 'NEW',
      });
    }
    if (path === 'courier/assign/awb')
      return json({
        awb_assign_status: 1,
        response: {
          data: {
            awb_code: 'AWB' + body.shipment_id,
            courier_company_id: body.courier_id ?? 10,
            courier_name: body.courier_id === 20 ? 'Air Co' : 'Surface Co',
          },
        },
      });
    if (path === 'courier/generate/label')
      return json({
        label_created: 1,
        label_url: 'https://labels.example/' + body.shipment_id[0] + '.pdf',
      });
    if (path === 'courier/generate/pickup')
      return json({
        pickup_status: 1,
        response: {
          pickup_scheduled_date: '2026-10-10 11:00:00',
          pickup_token_number: 'PU' + body.shipment_id[0],
        },
      });
    if (path === 'orders/cancel') return json({ status: 200 });
    if (path.startsWith('courier/track/awb/'))
      return json({
        tracking_data: {
          shipment_track_activities: trackingScans,
          track_url: 'https://track.example/x',
          etd: '2026-10-14 18:00:00',
        },
      });
    throw new Error('Unmocked Shiprocket path ' + path);
  }
  if (url.startsWith('https://api.razorpay.com/v1/')) {
    const path = url.slice('https://api.razorpay.com/v1/'.length);
    if (path === 'orders') {
      const id = 'order_fx' + razorpayOrders.size;
      razorpayOrders.set(id, body.amount);
      return json({ id });
    }
    const refund = /^payments\/([^/]+)\/refund$/.exec(path);
    if (refund)
      return json({ id: 'rfnd_fx' + ++refundCounter, status: 'pending', amount: body.amount });
    const payment = /^payments\/(pay_[^/]+)$/.exec(path);
    if (payment) {
      const order = [...razorpayOrders.keys()].find(
        (id) => 'pay_' + id.replace(/[^A-Za-z0-9]/g, '') === payment[1],
      )!;
      return json({
        id: payment[1],
        status: 'captured',
        amount: razorpayOrders.get(order),
        currency: 'INR',
        order_id: order,
      });
    }
    throw new Error('Unmocked Razorpay path ' + path);
  }
  return nativeFetch(input, init);
};

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/v1';
async function api(
  method: string,
  path: string,
  cookie = '',
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, ...(await response.json()) };
}
const tracking = (
  awb: string,
  status: string,
  timestamp: string,
  location = 'Hyderabad Hub',
  token = 'fixture-tracking-token',
) =>
  api(
    'POST',
    '/webhooks/shiprocket',
    '',
    {
      awb,
      current_status: status,
      current_timestamp: timestamp,
      scans: [
        {
          date: timestamp,
          status,
          activity: status + ' scan',
          location,
          'sr-status-label': status,
        },
      ],
    },
    { 'x-api-key': token },
  );
async function razorpayWebhook(event: string, payload: unknown, id: string) {
  const raw = JSON.stringify({ event, payload });
  const signature = createHmac('sha256', 'fixture-webhook-secret').update(raw).digest('hex');
  const response = await fetch(base + '/webhooks/razorpay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': id,
    },
    body: raw,
  });
  return response.status;
}

try {
  const customer = await User.create({
    name: 'Fulfil Customer',
    email: 'fulfil@check.example',
    role: 'CUSTOMER',
    active: true,
  });
  const admin = await User.create({
    name: 'Ops Admin',
    email: 'ops@check.example',
    role: 'SUPER_ADMIN',
    active: true,
  });
  const sales = await User.create({
    name: 'Sales Person',
    email: 'sales@check.example',
    role: 'SALES',
    active: true,
  });
  const cookie = 'megha_session=' + (await createSession(customer._id));
  const staff = 'megha_session=' + (await createSession(admin._id));
  const salesCookie = 'megha_session=' + (await createSession(sales._id));
  const product = await Product.create({
    name: 'Drain Valve',
    sku: 'FUL-01',
    partNumber: 'DV-100',
    slug: 'drain-valve',
    category: 'parts',
    price: 100000,
    gstRate: 18,
    stock: 20,
    reserved: 0,
    active: true,
    weight: 1.5,
  });
  const productId = String(product._id);
  const address = {
    line1: '12 Mill Road',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500003',
  };
  const stock = async () => (await Product.findById(productId).lean())!;

  // ---- Checkout: delivery options and order snapshot ----
  const rates = await api('POST', '/checkout/shipping-rates', '', {
    pincode: '500003',
    items: [{ productId, quantity: 2 }],
  });
  assert.equal(rates.status, 200, JSON.stringify(rates));
  assert.deepEqual(
    rates.data.map((o: { service: string }) => o.service),
    ['standard', 'express'],
  );
  assert.equal(rates.data[0].amount, 12050, 'Standard is the cheapest courier, in paise');
  assert.equal(rates.data[1].amount, 24000, 'Express is the fastest courier');
  assert.ok(!('courierId' in rates.data[0]), 'Couriers stay hidden from customers');
  const quote = await api('POST', '/checkout/validate', '', {
    items: [{ productId, quantity: 2 }],
    pincode: '500003',
    shippingService: 'express',
  });
  assert.equal(quote.data.shipping, 24000);

  async function placeAndPay(quantity = 2) {
    const placed = await api('POST', '/orders', cookie, {
      items: [{ productId, quantity }],
      idempotencyKey: randomUUID(),
      customer: {
        name: 'Fulfil Customer',
        email: 'fulfil@check.example',
        phone: '9876543210',
        gstin: '',
      },
      address,
      shippingService: 'express',
    });
    assert.equal(placed.status, 201, JSON.stringify(placed));
    const prepared = await api('POST', '/payments/order', cookie, { orderId: placed.data._id });
    assert.equal(prepared.status, 200, JSON.stringify(prepared));
    return { order: placed.data, providerOrderId: prepared.data.providerOrderId as string };
  }
  async function verify(orderId: string, providerOrderId: string) {
    const paymentId = 'pay_' + providerOrderId.replace(/[^A-Za-z0-9]/g, '');
    const signature = createHmac('sha256', 'fixture-secret')
      .update(providerOrderId + '|' + paymentId)
      .digest('hex');
    return api('POST', '/payments/razorpay/verify', cookie, {
      orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    });
  }

  const first = await placeAndPay();
  const orderId = first.order._id as string;
  assert.match(first.order.number, /^MEGHA-\d{4}-\d{6}$/);
  assert.equal(first.order.shippingService.service, 'express');
  assert.equal(first.order.items[0].partNumber, 'DV-100', 'Item snapshot keeps the part number');
  assert.equal((await stock()).reserved, 2);

  // Payment failure keeps the order; customer told; retry still possible.
  assert.equal(
    await razorpayWebhook(
      'payment.failed',
      {
        payment: {
          entity: {
            id: 'pay_failed1',
            status: 'failed',
            amount: first.order.total,
            currency: 'INR',
            order_id: first.providerOrderId,
          },
        },
      },
      'evt_fail1',
    ),
    200,
  );
  let order = (await Order.findById(orderId).lean())!;
  assert.equal(order.status, 'PENDING_PAYMENT');
  assert.equal(order.paymentStatus, 'FAILED');
  assert.ok(
    await Entity.exists({
      kind: 'notifications',
      number: 'order:' + order.number + ':PAYMENT_FAILED:pay_failed1',
    }),
  );

  const verified = await verify(orderId, first.providerOrderId);
  assert.equal(verified.status, 200, JSON.stringify(verified));
  order = (await Order.findById(orderId).lean())!;
  assert.equal(order.status, 'CONFIRMED');
  assert.equal(order.paymentStatus, 'CAPTURED');
  assert.deepEqual(order.history.map((h) => h.status).slice(-2), ['PAID', 'CONFIRMED']);
  assert.equal((await stock()).stock, 18);
  assert.equal(
    (await verify(orderId, first.providerOrderId)).status,
    200,
    'Repeat verification is idempotent',
  );
  assert.equal((await stock()).stock, 18);

  // ---- Admin: process and pack ----
  assert.equal((await api('GET', '/admin/orders?view=paid', staff)).data.total, 1);
  assert.equal(
    (
      await api('POST', '/admin/orders/' + orderId + '/pack', staff, {
        weight: 3,
        length: 30,
        breadth: 20,
        height: 15,
      })
    ).status,
    409,
    'Packing needs processing first',
  );
  assert.equal((await api('POST', '/admin/orders/' + orderId + '/process', staff)).status, 200);
  assert.equal(
    (await api('POST', '/admin/orders/' + orderId + '/process', salesCookie)).status,
    403,
    'Sales cannot run fulfilment',
  );
  assert.equal(
    (await api('POST', '/admin/orders/' + orderId + '/pack', staff, { weight: 3 })).status,
    400,
    'Parcel needs full dimensions',
  );
  assert.equal(
    (
      await api('POST', '/admin/orders/' + orderId + '/pack', staff, {
        weight: 3,
        length: 30,
        breadth: 20,
        height: 15,
        count: 1,
        notes: 'Bubble wrapped',
      })
    ).status,
    200,
  );
  const summary = async () =>
    Object.fromEntries(
      (await api('GET', '/admin/shipments/summary', staff)).data.views.map(
        (v: { key: string; count: number }) => [v.key, v.count],
      ),
    );
  assert.equal((await summary())['ready-to-ship'], 1);

  // ---- Shipment creation with a provider failure, then retry ----
  failNext.add('orders/create/adhoc');
  const failed = await api('POST', '/admin/orders/' + orderId + '/shipment', staff);
  assert.equal(failed.status, 502);
  order = (await Order.findById(orderId).lean())!;
  assert.equal(order.status, 'PACKED', 'Provider failure leaves the order intact');
  assert.equal(
    (await Shipment.findOne({ orderId, active: true }).lean())?.lastError?.step,
    'shipment',
  );
  assert.equal((await summary()).exceptions, 1, 'Failed provider steps show under Exceptions');
  const created = await api('POST', '/admin/orders/' + orderId + '/shipment', staff);
  assert.equal(created.status, 200, JSON.stringify(created));
  assert.equal(created.data.status, 'CREATED');
  const createCalls = calls['orders/create/adhoc'];
  await api('POST', '/admin/orders/' + orderId + '/shipment', staff);
  assert.equal(
    calls['orders/create/adhoc'],
    createCalls,
    'Repeat create does not call the provider again',
  );
  assert.equal((await Order.findById(orderId).lean())!.fulfilmentStatus, 'READY_TO_SHIP');

  // ---- Couriers, AWB (visible to the customer automatically) ----
  const couriers = await api('GET', '/admin/orders/' + orderId + '/couriers', staff);
  assert.equal(couriers.data.length, 2);
  assert.equal(couriers.data.find((c: { recommended: boolean }) => c.recommended).courierId, 10);
  const awb = await api('POST', '/admin/orders/' + orderId + '/awb', staff, { courierId: 20 });
  assert.equal(awb.status, 200, JSON.stringify(awb));
  const awbCode = awb.data.awb as string;
  assert.equal(awb.data.courierName, 'Air Co');
  let customerView = await api('GET', '/orders/' + orderId, cookie);
  assert.equal(
    customerView.data.shipment.awb,
    awbCode,
    'AWB reaches the customer without any manual step',
  );
  assert.equal(customerView.data.shipment.courierName, 'Air Co');

  // ---- Label: failure, retry, print, reprint ----
  failNext.add('courier/generate/label');
  assert.equal((await api('POST', '/admin/orders/' + orderId + '/label', staff)).status, 502);
  assert.equal(
    (await api('POST', '/admin/orders/' + orderId + '/label/print', staff)).status,
    409,
    'Cannot print before a label exists',
  );
  const label = await api('POST', '/admin/orders/' + orderId + '/label', staff);
  assert.equal(label.data.status, 'LABEL_GENERATED');
  assert.match(label.data.labelUrl, /^https:\/\/labels\.example\//);
  assert.equal((await summary())['label-ready'], 1);
  assert.equal((await summary()).exceptions, 0, 'Successful retry clears the error');
  const printed = await api('POST', '/admin/orders/' + orderId + '/label/print', staff);
  assert.equal(printed.data.labelPrinted, true);
  assert.equal(printed.data.labelPrintCount, 1);
  assert.equal(printed.data.labelPrintedBy, String(admin._id));
  const reprinted = await api('POST', '/admin/orders/' + orderId + '/label/print', staff);
  assert.equal(reprinted.data.labelPrintCount, 2);
  const shipmentRecord = (await Shipment.findOne({ orderId, active: true }).lean())!;
  assert.equal(shipmentRecord.labelPrints.length, 2, 'Every print is kept');
  assert.equal(shipmentRecord.labelPrints[1].reprint, true);
  assert.ok(await Audit.exists({ action: 'LABEL_PRINT' }));
  assert.ok(await Audit.exists({ action: 'LABEL_REPRINT' }));
  assert.equal((await summary())['label-printed'], 1);
  assert.equal((await summary())['label-ready'], 0);
  assert.equal(
    (await api('GET', '/admin/orders?view=ready-to-ship', staff)).data.items[0].shipment
      .labelStatus,
    'PRINTED',
  );

  // ---- Pickup: failure, retry; still not "shipped" ----
  failNext.add('courier/generate/pickup');
  assert.equal((await api('POST', '/admin/orders/' + orderId + '/pickup', staff)).status, 502);
  const pickup = await api('POST', '/admin/orders/' + orderId + '/pickup', staff);
  assert.equal(pickup.data.pickupStatus, 'SCHEDULED');
  assert.equal(pickup.data.pickupReference, 'PU' + shipmentRecord.providerShipmentId);
  assert.equal(
    (await Order.findById(orderId).lean())!.status,
    'PACKED',
    'Label + pickup never mark an order shipped',
  );

  // ---- Automated tracking via webhook ----
  assert.equal(
    (await tracking(awbCode, 'PICKED UP', '2026-10-10 12:00:00', 'Hyderabad', 'wrong-token'))
      .status,
    401,
  );
  assert.equal((await tracking(awbCode, 'PICKED UP', '2026-10-10 12:00:00')).status, 200);
  order = (await Order.findById(orderId).lean())!;
  assert.equal(order.status, 'SHIPPED', 'Shipped comes from the courier pickup scan');
  assert.equal(order.fulfilmentStatus, 'SHIPPED');
  assert.equal(order.shipment?.status, 'PICKED_UP');
  const eventsBefore = await ShipmentEvent.countDocuments();
  const duplicate = await tracking(awbCode, 'PICKED UP', '2026-10-10 12:00:00');
  assert.equal(duplicate.data.duplicate, true);
  assert.equal(
    await ShipmentEvent.countDocuments(),
    eventsBefore,
    'Duplicate webhook adds nothing',
  );
  await tracking(awbCode, 'IN TRANSIT', '2026-10-11 09:00:00', 'Bengaluru Hub');
  await tracking(awbCode, 'PICKED UP', '2026-10-10 11:59:00', 'Hyderabad');
  assert.equal(
    (await Shipment.findById(shipmentRecord._id).lean())!.status,
    'IN_TRANSIT',
    'An older scan never moves status back',
  );
  await tracking(awbCode, 'OUT FOR DELIVERY', '2026-10-12 08:30:00', 'Hyderabad');
  customerView = await api('GET', '/orders/track/' + order.number, cookie);
  assert.equal(customerView.status, 200);
  assert.equal(customerView.data.shipment.status, 'OUT_FOR_DELIVERY');
  assert.equal(customerView.data.shipment.lastEvent.location, 'Hyderabad');
  assert.ok(customerView.data.trackingEvents.length >= 3);
  assert.ok(
    !JSON.stringify(customerView.data).includes('fixture'),
    'No provider secrets reach customers',
  );
  assert.ok(
    !customerView.data.trackingEvents.some((e: Record<string, unknown>) => 'providerStatus' in e),
    'No raw courier codes',
  );
  assert.equal(
    (await api('GET', '/orders/track/' + order.number, salesCookie)).status,
    404,
    'Customers only see their own orders',
  );
  await tracking(awbCode, 'DELIVERED', '2026-10-12 14:10:00', 'Hyderabad');
  order = (await Order.findById(orderId).lean())!;
  assert.equal(order.status, 'DELIVERED');
  assert.ok(order.deliveredAt);
  for (const milestone of ['CONFIRMED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'])
    assert.equal(
      await Entity.countDocuments({
        kind: 'notifications',
        number: 'order:' + order.number + ':' + milestone,
      }),
      1,
      milestone + ' notified exactly once',
    );
  assert.equal(
    (await api('GET', '/admin/orders?q=' + awbCode, staff)).data.total,
    1,
    'Delivered orders stay searchable by AWB',
  );
  assert.equal((await api('GET', '/admin/shipments?view=delivered', staff)).data.total, 1);

  // ---- Return and refund ----
  assert.equal(
    (
      await api('POST', '/orders/' + orderId + '/returns', cookie, {
        items: [{ productId, quantity: 3 }],
        reason: 'DEFECTIVE',
        idempotencyKey: randomUUID(),
      })
    ).status,
    400,
  );
  const ret = await api('POST', '/orders/' + orderId + '/returns', cookie, {
    items: [{ productId, quantity: 1 }],
    reason: 'DEFECTIVE',
    comments: 'Leaks',
    idempotencyKey: randomUUID(),
  });
  assert.equal(ret.status, 201, JSON.stringify(ret));
  assert.equal((await Order.findById(orderId).lean())!.status, 'RETURN_REQUESTED');
  const returnPath = '/admin/orders/' + orderId + '/returns/' + ret.data._id;
  assert.equal(
    (
      await api('POST', returnPath + '/receive', staff, {
        items: [{ productId, quantity: 1, condition: 'RESTOCK' }],
      })
    ).status,
    409,
    'Approve before receiving',
  );
  assert.equal(
    (await api('POST', returnPath + '/decision', staff, { decision: 'APPROVE' })).status,
    200,
  );
  const stockBeforeReturn = (await stock()).stock!;
  assert.equal(
    (
      await api('POST', returnPath + '/receive', staff, {
        items: [{ productId, quantity: 1, condition: 'RESTOCK' }],
      })
    ).status,
    200,
  );
  assert.equal((await stock()).stock, stockBeforeReturn + 1);
  assert.ok(await Ledger.exists({ type: 'RETURN_RECEIVED', orderId }));
  assert.equal(
    (await api('POST', returnPath + '/refund', salesCookie, { idempotencyKey: randomUUID() }))
      .status,
    403,
    'Refunds need payments permission',
  );
  const refundKey = randomUUID();
  const returnRefund = await api('POST', returnPath + '/refund', staff, {
    idempotencyKey: refundKey,
  });
  assert.equal(returnRefund.status, 200, JSON.stringify(returnRefund));
  assert.equal((await Order.findById(orderId).lean())!.paymentStatus, 'REFUND_PENDING');
  const refundId = 'rfnd_fx' + refundCounter;
  assert.equal(
    await razorpayWebhook(
      'refund.processed',
      { refund: { entity: { id: refundId, status: 'processed' } } },
      'evt_rf1',
    ),
    200,
  );
  order = (await Order.findById(orderId).lean())!;
  assert.equal(order.paymentStatus, 'PARTIALLY_REFUNDED');
  assert.equal(order.refundedAmount, 118000, 'One unit including GST');
  assert.equal(
    await razorpayWebhook(
      'refund.processed',
      { refund: { entity: { id: refundId, status: 'processed' } } },
      'evt_rf1',
    ),
    200,
  );
  assert.equal(
    (await Order.findById(orderId).lean())!.refundedAmount,
    118000,
    'Duplicate refund webhook changes nothing',
  );

  // ---- NDR and RTO on a second order ----
  const second = await placeAndPay(1);
  const secondId = second.order._id as string;
  await verify(secondId, second.providerOrderId);
  await api('POST', '/admin/orders/' + secondId + '/process', staff);
  await api('POST', '/admin/orders/' + secondId + '/pack', staff, {
    weight: 2,
    length: 20,
    breadth: 20,
    height: 10,
  });
  await api('POST', '/admin/orders/' + secondId + '/shipment', staff);
  const secondAwb = (await api('POST', '/admin/orders/' + secondId + '/awb', staff, {})).data
    .awb as string;
  assert.equal(
    (await Shipment.findOne({ orderId: secondId, active: true }).lean())!.courierName,
    'Surface Co',
    'Recommended courier when none chosen',
  );
  await tracking(secondAwb, 'PICKED UP', '2026-10-10 12:00:00');
  await tracking(secondAwb, 'UNDELIVERED', '2026-10-12 15:00:00');
  let secondShipment = (await Shipment.findOne({ orderId: secondId }).lean())!;
  assert.equal(secondShipment.status, 'NDR');
  assert.equal(secondShipment.ndr?.attempts, 1);
  assert.equal((await summary())['ndr-rto'], 1);
  assert.equal(
    (
      await api('POST', '/admin/orders/' + secondId + '/ndr', staff, {
        action: 'CONTACTED_CUSTOMER',
        notes: 'Customer away; reattempt Monday',
      })
    ).status,
    200,
  );
  const stockBeforeRto = (await stock()).stock!;
  await tracking(secondAwb, 'RTO INITIATED', '2026-10-13 10:00:00');
  await tracking(secondAwb, 'RTO DELIVERED', '2026-10-15 10:00:00', 'Hyderabad Warehouse');
  secondShipment = (await Shipment.findOne({ orderId: secondId }).lean())!;
  assert.equal(secondShipment.status, 'RTO_DELIVERED');
  assert.equal((await Order.findById(secondId).lean())!.status, 'RETURNED');
  assert.equal(
    (await stock()).stock,
    stockBeforeRto,
    'RTO parcels are never restocked automatically',
  );
  const inspected = await api('POST', '/admin/orders/' + secondId + '/rto-inspection', staff, {
    goods: 'RESTOCK',
    refund: true,
    notes: 'Box intact',
    idempotencyKey: randomUUID(),
  });
  assert.equal(inspected.status, 200, JSON.stringify(inspected));
  assert.equal((await stock()).stock, stockBeforeRto + 1);
  assert.equal((await Order.findById(secondId).lean())!.paymentStatus, 'REFUND_PENDING');

  // ---- Cancellation before shipping, with a created shipment ----
  const third = await placeAndPay(1);
  const thirdId = third.order._id as string;
  await verify(thirdId, third.providerOrderId);
  await api('POST', '/admin/orders/' + thirdId + '/process', staff);
  await api('POST', '/admin/orders/' + thirdId + '/pack', staff, {
    weight: 2,
    length: 20,
    breadth: 20,
    height: 10,
  });
  await api('POST', '/admin/orders/' + thirdId + '/shipment', staff);
  const stockBeforeCancel = (await stock()).stock!;
  const cancelCalls = calls['orders/cancel'] ?? 0;
  const cancelled = await api('POST', '/admin/orders/' + thirdId + '/cancel', staff, {
    reason: 'Customer changed requirement',
    idempotencyKey: randomUUID(),
  });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled));
  assert.equal(calls['orders/cancel'], cancelCalls + 1, 'Provider shipment is cancelled');
  const thirdOrder = (await Order.findById(thirdId).lean())!;
  assert.equal(thirdOrder.status, 'CANCELLED');
  assert.equal(thirdOrder.cancelReason, 'Customer changed requirement');
  assert.equal(thirdOrder.paymentStatus, 'REFUND_PENDING', 'Paid cancellation is refunded');
  assert.equal((await stock()).stock, stockBeforeCancel + 1);
  assert.equal(await Shipment.countDocuments({ orderId: thirdId, active: true }), 0);
  assert.ok(await Audit.exists({ action: 'ORDER_CANCELLED', entityId: thirdId }));

  // ---- Manual tracking sync (missed webhook) and its failure ----
  const fourth = await placeAndPay(1);
  const fourthId = fourth.order._id as string;
  await verify(fourthId, fourth.providerOrderId);
  await api('POST', '/admin/orders/' + fourthId + '/process', staff);
  await api('POST', '/admin/orders/' + fourthId + '/pack', staff, {
    weight: 2,
    length: 20,
    breadth: 20,
    height: 10,
  });
  await api('POST', '/admin/orders/' + fourthId + '/shipment', staff);
  await api('POST', '/admin/orders/' + fourthId + '/awb', staff, {});
  failNext.add('courier/track/awb');
  assert.equal(
    (await api('POST', '/admin/orders/' + fourthId + '/tracking/sync', staff)).status,
    502,
  );
  trackingScans = [
    {
      date: '2026-10-10 13:00:00',
      status: 'PICKED UP',
      activity: 'Shipment picked up',
      location: 'Hyderabad',
      'sr-status-label': 'PICKED UP',
    },
    {
      date: '2026-10-11 08:00:00',
      status: 'IN TRANSIT',
      activity: 'Reached hub',
      location: 'Pune',
      'sr-status-label': 'IN TRANSIT',
    },
  ];
  const synced = await api('POST', '/admin/orders/' + fourthId + '/tracking/sync', staff);
  assert.equal(synced.data.applied, 2);
  assert.equal((await Order.findById(fourthId).lean())!.status, 'SHIPPED');
  assert.equal(
    (await api('POST', '/admin/orders/' + fourthId + '/tracking/sync', staff)).data.applied,
    0,
    'Re-sync is idempotent',
  );

  // ---- Scheduled tracking reconciliation (webhooks never arrived) ----
  const { reconcileTracking } = await import('../apps/api/src/jobs/tracking.job');
  const fifth = await placeAndPay(1);
  const fifthId = fifth.order._id as string;
  await verify(fifthId, fifth.providerOrderId);
  await api('POST', '/admin/orders/' + fifthId + '/process', staff);
  await api('POST', '/admin/orders/' + fifthId + '/pack', staff, {
    weight: 1,
    length: 10,
    breadth: 10,
    height: 10,
  });
  await api('POST', '/admin/orders/' + fifthId + '/shipment', staff);
  await api('POST', '/admin/orders/' + fifthId + '/awb', staff, {});
  // Delivered parcels are terminal and must never be polled, however old their last sync.
  const terminal = await Shipment.updateMany(
    { status: { $in: ['DELIVERED', 'RTO_DELIVERED'] } },
    { $set: { syncedAt: new Date(0) } },
  );
  assert.ok(terminal.matchedCount > 0);
  trackingScans = [
    {
      date: '2026-10-12 10:00:00',
      status: 'PICKED UP',
      activity: 'Shipment picked up',
      location: 'Hyderabad',
      'sr-status-label': 'PICKED UP',
    },
    {
      date: '2026-10-13 09:00:00',
      status: 'OUT FOR DELIVERY',
      activity: 'Out for delivery',
      location: 'Chennai',
      'sr-status-label': 'OUT FOR DELIVERY',
    },
  ];
  const tracksBefore = calls['courier/track/awb'] ?? 0;
  const scheduled = await reconcileTracking();
  assert.equal(scheduled.failed, 0);
  assert.equal(scheduled.applied, 2);
  assert.equal(calls['courier/track/awb'] - tracksBefore, scheduled.synced);
  const fifthShipment = await Shipment.findOne({ orderId: fifthId, active: true }).lean();
  assert.equal(fifthShipment!.status, 'OUT_FOR_DELIVERY');
  assert.equal((await Order.findById(fifthId).lean())!.status, 'SHIPPED');
  const tracksAfter = calls['courier/track/awb'];
  assert.equal((await reconcileTracking()).due, 0, 'Fresh and terminal shipments are skipped');
  assert.equal(calls['courier/track/awb'], tracksAfter);
  assert.equal((await api('GET', '/jobs/tracking')).status, 401);
  process.env.CRON_SECRET = 'fixture-cron-secret';
  const cron = await api('GET', '/jobs/tracking', '', undefined, {
    Authorization: 'Bearer fixture-cron-secret',
  });
  assert.equal(cron.status, 200);
  assert.equal(cron.data.due, 0);

  // ---- Dashboard figures agree with the stored records and the lists they link to ----
  const { Refund } = await import('../apps/api/src/modules/refunds/refund.model');
  const dashboard = await api('GET', '/admin/reports?range=30d', staff);
  assert.equal(dashboard.status, 200);
  const board = dashboard.data;
  const paidOrders = await Order.find(
    { paymentStatus: { $in: ['CAPTURED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
    { total: 1 },
  ).lean();
  const refunded = (await Refund.find({ status: 'PROCESSED' }).lean()).reduce(
    (sum, refund) => sum + (refund.amount ?? 0),
    0,
  );
  assert.equal(board.kpis.orders.value, paidOrders.length);
  assert.equal(
    board.kpis.grossSales.value,
    paidOrders.reduce((sum, order) => sum + (order.total ?? 0), 0),
  );
  assert.equal(board.kpis.refunds.value, refunded);
  assert.equal(board.kpis.netSales.value, board.kpis.grossSales.value - refunded);
  assert.equal(board.trend.length, 30);
  assert.equal(
    board.trend.reduce((sum: number, bucket: { sales: number }) => sum + bucket.sales, 0),
    board.kpis.grossSales.value,
    'Chart buckets add up to gross sales',
  );
  assert.ok(board.topProducts.length > 0 && board.recentOrders.length > 0);
  type Linked = { key: string; count: number; href: string };
  const exactLinks = [
    ...board.pipeline.filter((stage: Linked) => stage.key !== 'delivered'),
    ...board.attention.filter((item: Linked) =>
      ['exceptions', 'label-ready', 'pickup-pending', 'unbooked', 'to-process', 'to-pack'].includes(
        item.key,
      ),
    ),
  ];
  assert.ok(exactLinks.length >= 6);
  for (const entry of exactLinks as Linked[])
    assert.equal(
      (await api('GET', entry.href, staff)).data.total,
      entry.count,
      entry.key + ' count matches the list it opens',
    );
  const outOfStock = await api('GET', '/admin/inventory?view=out', staff);
  assert.ok(
    outOfStock.data.items.every(
      (product: { stock: number; reserved?: number }) =>
        product.stock - (product.reserved ?? 0) <= 0,
    ),
  );
  assert.equal((await api('GET', '/admin/reports?range=1y', staff)).status, 400);
  assert.equal(
    (await api('GET', '/admin/reports', salesCookie)).status,
    403,
    'Sales cannot see revenue',
  );
  const details = await api('GET', '/admin/orders/' + orderId + '/details', staff);
  assert.equal(details.status, 200);
  assert.ok(details.data.events.length >= 4);
  assert.equal(details.data.actors[String(admin._id)], 'Ops Admin');
  assert.ok(!('idempotencyKey' in details.data.order));
  assert.equal(
    (await api('PATCH', '/admin/orders/' + orderId, staff, { status: 'DELIVERED' })).status,
    409,
    'Statuses cannot be set by hand',
  );

  console.log(
    'Fulfilment checks passed (mocked Shiprocket and Razorpay transports): delivery options, order snapshots, payment failure and capture, processing/packing, shipment creation with failure and retry, courier choice, automatic AWB to customer, label failure/retry/print/reprint audit, pickup failure and retry, webhook auth and deduplication, forward-only tracking, customer tracking privacy, delivery, returns with restock and Razorpay refund webhooks, NDR, RTO inspection without auto-restock, paid cancellation with shipment cancel and refund, manual sync, scheduled tracking reconciliation, dashboard figures matching records and linked lists, and RBAC.',
  );
} finally {
  globalThis.fetch = nativeFetch;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  assert.equal(mongoose.connection.name, database);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
