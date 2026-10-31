import { chromium, expect } from '@playwright/test';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { randomBytes, createHash } from 'node:crypto';
dotenv.config({ path: 'apps/api/.env', quiet: true });
const web = process.env.WEB_URL || 'http://127.0.0.1:3000';
await mongoose.connect(process.env.MONGODB_URI);
const database = mongoose.connection.db;
const user = await database.collection('users').findOne({ role: 'SUPER_ADMIN', active: true });
if (!user) throw new Error('Seed a local administrator first.');
const token = randomBytes(32).toString('hex');
const hash = createHash('sha256').update(token).digest('hex');
await database
  .collection('sessions')
  .insertOne({ hash, userId: user._id, expiresAt: new Date(Date.now() + 300000) });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
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
  const page = await context.newPage();
  let lookupReads = 0;
  let productReads = 0;
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/admin/lookups') lookupReads++;
    if (path === '/api/v1/admin/products') productReads++;
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(web + '/admin', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  await expect(page.locator('.adm-dash-kpis')).toBeVisible();
  await page.screenshot({ path: '.local/screenshots/admin-dashboard.png', fullPage: true });
  // The dashboard warms the products list in the background; count reads from this load on.
  productReads = 0;
  await page.goto(web + '/admin/products', { waitUntil: 'networkidle' });
  await expect(page.getByRole('columnheader', { name: 'SKU', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add Product' }).click();
  await page.getByRole('tab', { name: 'Pricing & Tax' }).click();
  await expect(page.getByLabel('Price (₹)')).toBeVisible();
  await page.getByRole('tab', { name: 'Basic' }).click();
  await expect(page.getByLabel('Category', { exact: false })).toBeVisible();
  await expect
    .poll(() => page.getByLabel('Category', { exact: false }).locator('option').count())
    .toBeGreaterThan(1);
  await page.screenshot({ path: '.local/screenshots/admin-product-form.png', fullPage: true });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Add Product' }).click();
  await expect
    .poll(() => page.getByLabel('Category', { exact: false }).locator('option').count())
    .toBeGreaterThan(1);
  expect(lookupReads).toBe(1);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('a[href="/admin/inventory"]').first().click();
  await expect(page.locator('.adm-table')).toBeVisible();
  await page.locator('a[href="/admin/products"]').first().click();
  await expect(page.locator('.adm-table')).toBeVisible();
  expect(productReads).toBe(1);
  await page.locator('a[href="/admin/inventory"]').first().click();
  await page.locator('.adm-table tbody tr').first().click();
  await expect(page.getByRole('heading', { name: 'Adjust stock', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(web + '/admin', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '.local/screenshots/admin-mobile.png', fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('a[href="/account"]').first().click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to Megha', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Welcome to Megha', exact: true })).toBeVisible();
  await expect(page.locator('.adm-dash')).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    'Admin browser checks passed: dashboard, deep links, cached products/lookups, product form, stock workflow, mobile layout and logout protection.',
  );
} finally {
  await browser.close();
  await database.collection('sessions').deleteOne({ hash });
  await mongoose.disconnect();
}
