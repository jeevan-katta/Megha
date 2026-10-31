import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import type { AddressInfo } from 'node:net';
// This suite owns one temporary database, never the application's data.
const database = 'megha_check_' + randomUUID().replaceAll('-', '');
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27018/' + database + '?replicaSet=megha';
process.env.APP_MODE = 'development';
process.env.PAYMENT_PROVIDER = 'development';
process.env.ENABLE_CHECKOUT = 'true';
process.env.EMAIL_PROVIDER = 'disabled';
process.env.PINCODE_LOOKUP = 'disabled';
const { default: app } = await import('../apps/api/src/app');
const { connectDatabase } = await import('../apps/api/src/database/mongoose');
const { User } = await import('../apps/api/src/modules/users/user.model');
const { Product } = await import('../apps/api/src/modules/products/product.model');
const { createSession } = await import('../apps/api/src/modules/auth/session.service');
await connectDatabase();
await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/v1';
async function request(path: string, cookie = '', body?: unknown, method?: string) {
  const response = await fetch(base + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, ...(await response.json()) };
}
try {
  const admin = await User.create({
    name: 'Test Admin',
    email: 'admin@check.example',
    role: 'SUPER_ADMIN',
    active: true,
  });
  const staffCookie = 'megha_session=' + (await createSession(admin._id));
  const customer = await User.create({
    name: 'Customer',
    email: 'customer@check.example',
    role: 'CUSTOMER',
    active: true,
  });
  const customerCookie = 'megha_session=' + (await createSession(customer._id));
  assert.equal((await request('/admin/products', customerCookie)).status, 403);
  assert.equal((await request('/admin/products')).status, 401);
  const category = await request('/admin/categories', staffCookie, {
    name: 'Test category',
    slug: 'test-category',
    image: '/assets/pressure-switch.webp',
  });
  assert.equal(category.status, 201, JSON.stringify(category));
  const created = await request('/admin/products', staffCookie, {
    name: 'Test Part',
    slug: 'test-part',
    sku: 'CHECK-01',
    category: 'test-category',
    image: '/assets/pressure-switch.webp',
    price: 10000,
    gstRate: 18,
  });
  assert.equal(created.status, 201, JSON.stringify(created));
  const productId = created.data._id;
  const adjustment = { quantity: 5, reason: 'Initial test receipt', idempotencyKey: randomUUID() };
  assert.equal(
    (await request('/admin/inventory/' + productId + '/adjust', staffCookie, adjustment)).status,
    200,
  );
  await request('/admin/inventory/' + productId + '/adjust', staffCookie, adjustment);
  assert.equal((await Product.findById(productId))?.stock, 5);
  const checkout = {
    items: [{ productId, quantity: 2 }],
    idempotencyKey: randomUUID(),
    customer: { name: 'Test Customer', email: customer.email, phone: '9999999999' },
    address: { line1: '1 Test Road', city: 'Hyderabad', state: 'Telangana', pincode: '500003' },
  };
  const order = await request('/orders', customerCookie, checkout);
  assert.equal(order.status, 201, JSON.stringify(order));
  assert.equal((await Product.findById(productId))?.reserved, 2);
  const decrease = await request('/admin/inventory/' + productId + '/adjust', staffCookie, {
    quantity: -4,
    reason: 'Cannot consume reservations',
    idempotencyKey: randomUUID(),
  });
  assert.equal(decrease.status, 409);
  assert.equal(
    (await request('/payments/development/confirm', customerCookie, { orderId: order.data._id }))
      .status,
    200,
  );
  await request('/payments/development/confirm', customerCookie, { orderId: order.data._id });
  assert.equal((await Product.findById(productId))?.stock, 3);
  assert.equal((await Product.findById(productId))?.reserved, 0);
  const list = await request('/admin/products?q=CHECK-01&page=1', staffCookie);
  assert.equal(list.data.total, 1);
  const requestRecord = await request('/requests/service-requests', customerCookie, {
    title: 'Repair request',
    name: 'Customer',
    email: customer.email,
    phone: '9999999999',
    description: 'Machine requires a repair',
    data: {},
  });
  assert.equal(requestRecord.status, 201, JSON.stringify(requestRecord));
  await request(
    '/admin/service-requests/' + requestRecord.data._id,
    staffCookie,
    {
      data: {
        internalNotes: 'Staff only secret',
        publicResponse: 'We are reviewing your request.',
      },
    },
    'PATCH',
  );
  const records = await request('/me/records/service-requests', customerCookie);
  assert.equal(records.data[0].data.internalNotes, undefined);
  assert.equal(records.data[0].data.publicResponse, 'We are reviewing your request.');
  const audit = await request('/admin/audit', staffCookie);
  assert.ok(audit.data.total >= 3);
  console.log(
    'API checks passed: staff RBAC, catalogue CRUD, stock idempotency, reserved inventory, checkout capture, customer privacy, search and audit.',
  );
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  assert.equal(mongoose.connection.name, database);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
