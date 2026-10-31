// Email, password reset and customer-messaging checks against an isolated database. Emails go to
// a temporary outbox folder through the development provider; nothing is sent.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import type { AddressInfo } from 'node:net';
const database = 'megha_email_check_' + randomUUID().replaceAll('-', '');
const outbox = await mkdtemp(path.join(os.tmpdir(), 'megha-outbox-'));
Object.assign(process.env, {
  MONGODB_URI: 'mongodb://127.0.0.1:27018/' + database + '?replicaSet=megha',
  APP_MODE: 'development',
  PAYMENT_PROVIDER: 'development',
  SHIPPING_PROVIDER: 'development',
  ENABLE_CHECKOUT: 'true',
  EMAIL_PROVIDER: 'development',
  PINCODE_LOOKUP: 'disabled',
  EMAIL_OUTBOX_DIR: outbox,
  STAFF_ALERT_EMAIL: 'sales@check.example',
  SITE_URL: 'https://shop.check.example',
});
const { default: app } = await import('../apps/api/src/app');
const { connectDatabase } = await import('../apps/api/src/database/mongoose');
const { User } = await import('../apps/api/src/modules/users/user.model');
const { Product } = await import('../apps/api/src/modules/products/product.model');
const { Email } = await import('../apps/api/src/modules/email/email.model');
const { Entity } = await import('../apps/api/src/modules/records/record.model');
const { deliverEmails } = await import('../apps/api/src/modules/email/email.service');
const { notifyOnce } = await import('../apps/api/src/modules/notifications/notification.service');
const { createSession } = await import('../apps/api/src/modules/auth/session.service');
await connectDatabase();
await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/v1';
async function request(path: string, body?: unknown, cookie = '') {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '',
    ...(await response.json()),
  };
}
const sentTo = async (to: string) => {
  const files = (await readdir(outbox)).filter((file) => file.includes(to.replace('@', '@')));
  return Promise.all(files.map((file) => readFile(path.join(outbox, file), 'utf8')));
};
try {
  // ---- Registration, then a request: customer acknowledgement and staff alert ----
  const signup = await request('/auth/register', {
    name: 'Email Customer',
    email: 'buyer@check.example',
    password: 'Original-Password-1',
  });
  assert.equal(signup.status, 201, JSON.stringify(signup));
  const enquiry = await request(
    '/requests/enquiries',
    {
      title: 'Enquiry: Drain Pump',
      name: 'Email Customer',
      email: 'buyer@check.example',
      phone: '98765 43210',
      description: 'Need ten drain pumps.',
      data: { quantity: 10 },
    },
    signup.cookie,
  );
  assert.equal(enquiry.status, 201, JSON.stringify(enquiry));
  await deliverEmails();
  const [ack] = await sentTo('buyer@check.example');
  assert.match(ack, /Subject: We received your enquiry/);
  assert.match(ack, new RegExp(enquiry.data.number));
  const [alert] = await sentTo('sales@check.example');
  assert.match(alert, /New enquiry: Enquiry: Drain Pump/);
  assert.match(alert, /https:\/\/shop\.check\.example\/admin\/enquiries/);

  // ---- Friendly validation messages ----
  const badPhone = await request('/requests/enquiries', {
    title: 'Hello',
    name: 'X Y',
    email: 'x@check.example',
    phone: '12345',
    description: 'Testing phone.',
  });
  assert.equal(badPhone.status, 400);
  assert.equal(
    badPhone.error.fieldErrors[0].message,
    'Enter a valid 10-digit mobile number, for example 98765 43210.',
  );
  const tenDashes = await request('/requests/enquiries', {
    title: 'Hello',
    name: 'X Y',
    email: 'x@check.example',
    phone: '----------',
    description: 'Testing phone.',
  });
  assert.equal(tenDashes.status, 400, 'A phone number needs real digits');

  // ---- Password reset ----
  const generic =
    'If an account exists for that email, we have sent a link to reset the password. It expires in 30 minutes.';
  const unknown = await request('/auth/forgot-password', { email: 'nobody@check.example' });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.data.message, generic, 'Same answer for unknown emails');
  assert.equal(await Email.countDocuments({ to: 'nobody@check.example' }), 0);
  const forgot = await request('/auth/forgot-password', { email: 'BUYER@check.example' });
  assert.equal(forgot.data.message, generic);
  await deliverEmails();
  const resetMail = (await sentTo('buyer@check.example')).find((mail) =>
    mail.includes('Reset your Megha password'),
  );
  assert.ok(resetMail, 'Reset email written');
  const token = resetMail.match(/reset-password\?token=([a-f0-9]{64})/)?.[1];
  assert.ok(token, 'Reset link contains a token');
  const stored = await Email.findOne({ subject: 'Reset your Megha password' }).lean();
  assert.equal(stored?.status, 'SENT');
  assert.equal(stored?.text, undefined, 'The reset link is not kept after sending');
  assert.equal(
    (await request('/auth/reset-password', { token: 'f'.repeat(64), password: 'New-Password-123' }))
      .status,
    400,
    'Unknown token refused',
  );
  assert.equal(
    (await request('/auth/reset-password', { token, password: 'short' })).status,
    400,
    'Weak password refused',
  );
  const reset = await request('/auth/reset-password', { token, password: 'New-Password-123' });
  assert.equal(reset.status, 200, JSON.stringify(reset));
  assert.equal((await request('/me', undefined, signup.cookie)).status, 401, 'Old session ended');
  assert.equal(
    (
      await request('/auth/login', {
        email: 'buyer@check.example',
        password: 'Original-Password-1',
      })
    ).status,
    401,
  );
  assert.equal(
    (await request('/auth/login', { email: 'buyer@check.example', password: 'New-Password-123' }))
      .status,
    200,
  );
  assert.equal(
    (await request('/auth/reset-password', { token, password: 'Another-Password-1' })).status,
    400,
    'A link works once',
  );
  await deliverEmails();
  assert.ok(
    (await sentTo('buyer@check.example')).some((mail) => mail.includes('password was changed')),
  );

  // ---- Notifications email once, and never for a rolled-back change ----
  const buyer = await User.findOne({ email: 'buyer@check.example' }).lean();
  const userId = String(buyer!._id);
  await notifyOnce(userId, 'order:MEGHA-2026-000777:DELIVERED', 'Order delivered', 'Delivered.');
  await notifyOnce(userId, 'order:MEGHA-2026-000777:DELIVERED', 'Order delivered', 'Delivered.');
  assert.equal(await Email.countDocuments({ subject: 'Order delivered' }), 1);
  const session = await mongoose.startSession();
  await assert.rejects(
    session.withTransaction(async () => {
      await notifyOnce(
        userId,
        'order:MEGHA-2026-000778:PACKED',
        'Order packed',
        'Packed.',
        {},
        session,
      );
      throw new Error('roll back');
    }),
  );
  await session.endSession();
  assert.equal(await Entity.countDocuments({ number: 'order:MEGHA-2026-000778:PACKED' }), 0);
  assert.equal(await Email.countDocuments({ subject: 'Order packed' }), 0);
  await deliverEmails();
  const delivered = (await sentTo('buyer@check.example')).find((mail) =>
    mail.includes('Subject: Order delivered'),
  );
  assert.match(delivered!, /https:\/\/shop\.check\.example\/track\/MEGHA-2026-000777/);

  // ---- A failed send is retried later, not lost ----
  await rm(outbox, { recursive: true, force: true });
  await writeFile(outbox, 'blocks the outbox folder');
  await notifyOnce(userId, 'order:MEGHA-2026-000779:SHIPPED', 'Order shipped', 'Shipped.');
  const failedRun = await deliverEmails();
  assert.equal(failedRun.failed, 1);
  const retry = await Email.findOne({ subject: 'Order shipped' }).lean();
  assert.equal(retry?.status, 'PENDING');
  assert.equal(retry?.attempts, 1);
  assert.equal((await deliverEmails()).sent, 0, 'Waits for the back-off');
  await rm(outbox, { force: true });
  await Email.updateOne({ _id: retry!._id }, { $set: { lockedUntil: new Date(0) } });
  assert.equal((await deliverEmails()).sent, 1);

  // ---- Checkout refuses an order when prices changed after the total was shown ----
  const product = await Product.create({
    name: 'Email Check Part',
    slug: 'email-check-part',
    sku: 'EMAIL-01',
    category: 'test',
    image: '/assets/part-0.webp',
    price: 10000,
    gstRate: 18,
    stock: 5,
    reserved: 0,
    active: true,
  });
  const customer = 'megha_session=' + (await createSession(buyer!._id));
  const order = (expectedTotal: number) =>
    request(
      '/orders',
      {
        items: [{ productId: String(product._id), quantity: 1 }],
        idempotencyKey: randomUUID(),
        customer: { name: 'Email Customer', email: 'buyer@check.example', phone: '9876543210' },
        address: {
          line1: 'Plot 7, Industrial Area',
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500003',
        },
        shippingService: 'standard',
        expectedTotal,
      },
      customer,
    );
  const quoted = await request('/checkout/validate', {
    items: [{ productId: String(product._id), quantity: 1 }],
    pincode: '500003',
    shippingService: 'standard',
  });
  const stale = await order(quoted.data.total - 100);
  assert.equal(stale.status, 409);
  assert.equal(stale.error.code, 'PRICE_CHANGED');
  assert.match(stale.error.message, /The new total is ₹/);
  assert.equal((await Product.findById(product._id).lean())?.reserved, 0, 'Nothing reserved');
  assert.equal((await order(quoted.data.total)).status, 201);

  // ---- PIN code lookup (pre-cached, so no network) and address checks at order time ----
  const { Pincode } = await import('../apps/api/src/modules/pincodes/pincode.service');
  await Pincode.create([
    { pincode: '507103', found: true, city: 'Khammam', state: 'Telangana', places: ['Penagadapa'] },
    { pincode: '999999', found: false },
  ]);
  const found = await request('/checkout/pincode/507103');
  assert.equal(found.status, 200);
  assert.deepEqual([found.data.city, found.data.state], ['Khammam', 'Telangana']);
  assert.equal((await request('/checkout/pincode/999999')).status, 404);
  assert.equal(
    (await request('/checkout/pincode/123456')).status,
    503,
    'Unknown to the cache and lookup disabled: customer types city and state',
  );
  const withAddress = (address: Record<string, string>) =>
    request(
      '/orders',
      {
        items: [{ productId: String(product._id), quantity: 1 }],
        idempotencyKey: randomUUID(),
        customer: {
          name: 'Email Customer',
          email: 'buyer@check.example',
          phone: '+91 98765 43210',
        },
        address,
        shippingService: 'standard',
      },
      customer,
    );
  const wrongState = await withAddress({
    line1: 'Plot 7, Industrial Area',
    city: 'Khammam',
    state: 'Karnataka',
    pincode: '507103',
  });
  assert.equal(wrongState.status, 400);
  assert.match(wrongState.error.message, /PIN code 507103 is in Telangana/);
  const missingPin = await withAddress({
    line1: 'Plot 7, Industrial Area',
    city: 'Khammam',
    state: 'Telangana',
    pincode: '999999',
  });
  assert.match(missingPin.error.message, /couldn't find PIN code 999999/);
  const garbage = await withAddress({
    line1: 'ytghuihiuh',
    city: 'i7yg7g6',
    state: 'uyg67t6',
    pincode: '507103',
  });
  assert.equal(garbage.status, 400);
  assert.ok(
    garbage.error.fieldErrors.some(
      (f: { message: string }) => f.message === 'Enter a valid city name (letters only).',
    ) &&
      garbage.error.fieldErrors.some((f: { message: string }) => f.message === 'Choose a state.'),
  );
  const good = await withAddress({
    line1: 'Plot 7, Industrial Area',
    city: 'Khammam',
    state: 'Telangana',
    pincode: '507103',
  });
  assert.equal(good.status, 201, JSON.stringify(good));
  assert.equal(good.data.customer.phone, '9876543210', 'Phone stored as 10 digits');
  const longPhone = await request('/requests/enquiries', {
    title: 'Hello',
    name: 'X Y',
    email: 'x@check.example',
    phone: '98525987562',
    description: 'Eleven digits.',
  });
  assert.equal(longPhone.status, 400, 'An 11-digit number is refused');
  assert.equal(
    (
      await request('/auth/register', {
        name: 'Bad Mail',
        email: 'a@b.c',
        password: 'Long-Password-1',
      })
    ).status,
    400,
    'An email without a real domain is refused',
  );

  console.log(
    'Email checks passed: request acknowledgement and staff alert, friendly phone validation, password reset (generic answer, single-use link, weak password refused, sessions ended, change notice, link not stored after sending), notification emails sent once and never for rolled-back changes, failed sends retried with back-off, checkout refusing orders after a price change, PIN code lookup, PIN/state checks, strict phone, email and address validation.',
  );
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  assert.equal(mongoose.connection.name, database);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await rm(outbox, { recursive: true, force: true });
}
