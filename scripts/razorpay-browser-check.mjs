import { chromium, expect } from '@playwright/test';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
dotenv.config({ path: 'apps/api/.env', quiet: true });
if (!process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_'))
  throw new Error('This check requires test keys.');
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const suffix = randomUUID().slice(0, 8);
const userId = new mongoose.Types.ObjectId(),
  productId = new mongoose.Types.ObjectId();
const token = randomBytes(32).toString('hex'),
  hash = createHash('sha256').update(token).digest('hex');
await db.collection('users').insertOne({
  _id: userId,
  name: 'Checkout Integration Test',
  email: 'checkout-' + suffix + '@example.com',
  role: 'CUSTOMER',
  active: true,
});
await db.collection('products').insertOne({
  _id: productId,
  name: 'Checkout Test Part',
  slug: 'checkout-check-' + suffix,
  sku: 'CHECK-' + suffix,
  partNumber: 'TEST',
  image: '/assets/part-0.webp',
  category: 'washing-machine-parts',
  description: 'Temporary automated test fixture',
  price: 100,
  gstRate: 18,
  stock: 1,
  reserved: 0,
  active: true,
  keywords: [],
  specifications: [],
  developmentOnly: true,
});
await db
  .collection('sessions')
  .insertOne({ hash, userId, expiresAt: new Date(Date.now() + 300000) });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([
    {
      name: 'megha_session',
      value: token,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await context.addInitScript(
    ({ id }) =>
      localStorage.setItem('megha-cart', JSON.stringify([{ productId: id, quantity: 1 }])),
    { id: String(productId) },
  );
  const page = await context.newPage();
  await page.goto((process.env.WEB_URL || 'http://127.0.0.1:3000') + '/checkout', {
    waitUntil: 'networkidle',
  });
  for (const [name, value] of Object.entries({
    phone: '9999999999',
    line1: '1 Integration Test Road',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500003',
  }))
    await page.locator('input[name="' + name + '"]').fill(value);
  // Checkout has two checkboxes (billing same as shipping, and the test-order consent).
  await page.locator('.delivery-option').first().waitFor({ timeout: 20000 });
  await page.locator('label.check-label input[type=checkbox][required]').check();
  await page.getByRole('button', { name: 'Pay with Razorpay (Test)' }).click();
  await expect(page.locator('iframe.razorpay-checkout-frame')).toBeVisible({ timeout: 45000 });
  await expect(
    page
      .frameLocator('iframe.razorpay-checkout-frame')
      .getByRole('button', { name: /Pay|Continue|Proceed|Netbanking|Card|UPI/ })
      .first(),
  ).toBeVisible({ timeout: 45000 });
  await page.screenshot({ path: '.local/screenshots/razorpay-test-checkout.png', fullPage: true });
  console.log(
    'Real Razorpay test order created through the app; hosted Checkout opened successfully. No payment was submitted.',
  );
} finally {
  await browser.close();
  // Only this script's dedicated fixtures are removed. No existing stock is changed.
  const orders = await db.collection('orders').find({ userId }).project({ _id: 1 }).toArray();
  await db.collection('inventorytransactions').deleteMany({ productId: String(productId) });
  await db
    .collection('orders')
    .deleteMany({ _id: { $in: orders.map((order) => order._id) }, userId });
  await db.collection('products').deleteOne({ _id: productId });
  await db.collection('sessions').deleteOne({ hash });
  await db.collection('users').deleteOne({ _id: userId });
  await mongoose.disconnect();
}
