// Usage: npm run profile -- <label>
// Optional: WEB_URL (default http://127.0.0.1:3000) and API_URL (default http://127.0.0.1:5000).
// LATENCY_MS adds browser network latency per request, approximating a deployed site.
// Profile a production build (`npm run build` then `npm run preview`); dev compilation skews timings.
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createHash, randomBytes } from 'node:crypto';
dotenv.config({ path: 'apps/api/.env', quiet: true });
const label = process.argv[2] || 'baseline';
const web = process.env.WEB_URL || 'http://127.0.0.1:3000';
const api = (process.env.API_URL || 'http://127.0.0.1:5000') + '/api/v1';
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const user = await db.collection('users').findOne({ role: 'SUPER_ADMIN', active: true });
const token = randomBytes(32).toString('hex');
const hash = createHash('sha256').update(token).digest('hex');
await db
  .collection('sessions')
  .insertOne({ hash, userId: user._id, expiresAt: new Date(Date.now() + 900000) });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const result = { label, api: [], navigation: [], hardLoads: [], requests: [], queries: [] };
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
try {
  const order = await db.collection('orders').findOne({ userId: user._id });
  const product = await db.collection('products').findOne({ active: true });
  const endpoints = [
    ['GET', '/config'],
    ['GET', '/catalogue'],
    ['GET', '/me'],
    ['GET', '/me/orders'],
    ['GET', '/me/records/enquiries'],
    ['GET', '/me/records/addresses'],
    ...(order ? [['GET', '/orders/' + order._id]] : []),
    ['POST', '/checkout/validate', { items: [{ productId: String(product._id), quantity: 1 }] }],
    ['GET', '/admin/reports'],
    ['GET', '/admin/lookups'],
    ['GET', '/admin/products?page=1&status=&q=&sort=newest'],
    ['GET', '/admin/inventory?page=1&status=&q=&sort=newest'],
    ['GET', '/admin/orders?page=1&status=&q=&sort=newest'],
    ['GET', '/admin/shipments?page=1&status=&q=&sort=newest'],
    ['GET', '/admin/customers?page=1&status=&q=&sort=newest'],
    ['GET', '/admin/service-requests?page=1&status=&q=&sort=newest'],
    ['GET', '/admin/enquiries?page=1&status=&q=&sort=newest'],
  ];
  for (const [method, endpoint, body] of endpoints) {
    const times = [];
    const serverTimes = [];
    let bytes = 0;
    for (let i = 0; i < 7; i++) {
      const started = performance.now();
      const response = await fetch(api + endpoint, {
        method,
        headers: {
          Cookie: 'megha_session=' + token,
          Origin: web,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      if (!response.ok) throw new Error(endpoint + ': ' + response.status + ' ' + text);
      bytes = Buffer.byteLength(text);
      times.push(Math.round(performance.now() - started));
      const server = /dur=([\d.]+)/.exec(response.headers.get('server-timing') ?? '');
      if (server) serverTimes.push(Math.round(Number(server[1])));
    }
    result.api.push({
      endpoint: method + ' ' + endpoint.split('?')[0],
      medianMs: median(times),
      maxMs: Math.max(...times),
      serverMedianMs: serverTimes.length ? median(serverTimes) : null,
      firstMs: times[0],
      bytes,
    });
  }
  for (const [collection, filter, sort] of [
    ['orders', { userId: user._id }, { createdAt: -1 }],
    ['orders', { status: 'PENDING_PAYMENT', reservationExpires: { $lt: new Date() } }, {}],
    ['entities', { kind: 'service-requests' }, { createdAt: -1, _id: -1 }],
    ['entities', { kind: 'enquiries', ownerId: user._id }, { createdAt: -1 }],
    ['products', {}, { createdAt: -1, _id: -1 }],
    ['users', { role: 'CUSTOMER' }, { createdAt: -1, _id: -1 }],
  ]) {
    const plan = await db
      .collection(collection)
      .find(filter)
      .sort(sort)
      .limit(25)
      .explain('executionStats');
    const stages = JSON.stringify(plan.queryPlanner.winningPlan).match(/"stage":"(\w+)"/g) ?? [];
    result.queries.push({
      collection,
      filter: Object.keys(filter).join(',') || '(all)',
      examined: plan.executionStats.totalDocsExamined,
      returned: plan.executionStats.nReturned,
      stages: stages.map((stage) => stage.slice(9, -1)).join(' > '),
    });
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([
    { name: 'megha_session', value: token, domain: '127.0.0.1', path: '/', httpOnly: true },
  ]);
  const page = await context.newPage();
  if (process.env.LATENCY_MS) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: Number(process.env.LATENCY_MS),
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    result.latencyMs = Number(process.env.LATENCY_MS);
  }
  const startTimes = new WeakMap();
  page.on('request', (request) => startTimes.set(request, performance.now()));
  page.on('response', async (response) => {
    if (!response.url().includes('/api/v1/')) return;
    await response.finished();
    result.requests.push({
      path: new URL(response.url()).pathname,
      durationMs: Math.round(performance.now() - startTimes.get(response.request())),
    });
  });
  // Flags loading/blank states that appear between a click and the finished screen.
  await page.addInitScript(() => {
    window.__sawLoading = false;
    new MutationObserver(() => {
      if (document.querySelector('.loading-state, [role="status"]')) window.__sawLoading = true;
    }).observe(document, { childList: true, subtree: true });
  });
  for (const [route, ready] of [
    ['/', '.category-grid .category-card'],
    ['/spare-parts', '.catalogue-products .product-card'],
    ['/admin/products', '.adm-table'],
  ]) {
    const started = performance.now();
    await page.goto(web + route);
    await page.locator(ready).first().waitFor();
    result.hardLoads.push({ route, ms: Math.round(performance.now() - started) });
  }
  await page.goto(web + '/');
  await page.locator('.category-grid .category-card').first().waitFor();
  await page.waitForLoadState('networkidle');
  const adminReady = (title) => [
    `.adm-page-head h1:text-is("${title}")`,
    '.adm-content .adm-table, .adm-content .adm-empty, .adm-content .adm-dash-kpis',
  ];
  for (const [route, readySelectors] of [
    ['/spare-parts', ['.catalogue-products .product-card']],
    ['/product/' + product.slug, ['.detail-layout .detail-image img']],
    ['/cart', ['.page-title h1']],
    ['/spare-parts', ['.catalogue-products .product-card']],
    ['/account', ['.account-layout .stat-grid']],
    ['/account/profile', ['#details input[name="name"]']],
    ['/account/orders', ['.account-layout .panel h2:text-is("My Orders")']],
    ['/account/enquiries', ['.account-layout .panel h2:text-is("My Enquiries")']],
    ['/account', ['.account-layout .stat-grid']],
    ['/admin', adminReady('Dashboard')],
    ['/admin/products', adminReady('Products')],
    ['/admin/inventory', adminReady('Inventory')],
    ['/admin/orders', adminReady('Orders')],
    ['/admin/shipments', adminReady('Shipments')],
    ['/admin/customers', adminReady('Customers')],
    ['/admin/service-requests', adminReady('Service Requests')],
    ['/admin/enquiries', adminReady('Enquiries')],
    ['/admin/products', adminReady('Products')],
    ['/admin/orders', adminReady('Orders')],
    ['/admin/reports', adminReady('Dashboard')],
    ['/', ['.category-grid .category-card']],
  ]) {
    const before = result.requests.length;
    await page.evaluate(() => (window.__sawLoading = false));
    const link = page.locator('a[href="' + route + '"]:visible').first();
    await link.waitFor();
    const started = performance.now();
    await link.click();
    const clicked = performance.now();
    await page.waitForURL((url) => url.pathname === route.split('?')[0], { timeout: 15000 });
    const committed = performance.now();
    for (const selector of readySelectors) await page.locator(selector).first().waitFor();
    const ready = performance.now();
    await page.waitForTimeout(150);
    result.navigation.push({
      route,
      clickToUrlMs: Math.round(committed - clicked),
      clickToReadyMs: Math.round(ready - clicked),
      playwrightClickMs: Math.round(clicked - started),
      apiRequests: result.requests.length - before,
      sawLoading: await page.evaluate(() => window.__sawLoading),
    });
  }
  fs.mkdirSync('.local/performance', { recursive: true });
  fs.writeFileSync('.local/performance/' + label + '.json', JSON.stringify(result, null, 2));
  console.log('API (ms): endpoint | median | max | server median | first | bytes');
  for (const row of result.api)
    console.log(
      [row.endpoint.padEnd(38), row.medianMs, row.maxMs, row.serverMedianMs, row.firstMs, row.bytes]
        .map(String)
        .join(' | '),
    );
  console.log('\nQuery plans: collection | filter | examined | returned | stages');
  for (const q of result.queries)
    console.log([q.collection, q.filter, q.examined, q.returned, q.stages].join(' | '));
  console.log('\nHard loads (ms):', JSON.stringify(result.hardLoads));
  console.log('\nNavigation: route | click→URL | click→ready | API calls | loading shown');
  for (const n of result.navigation)
    console.log(
      [n.route.padEnd(26), n.clickToUrlMs, n.clickToReadyMs, n.apiRequests, n.sawLoading].join(
        ' | ',
      ),
    );
} finally {
  await browser.close();
  await db.collection('sessions').deleteOne({ hash });
  await mongoose.disconnect();
}
