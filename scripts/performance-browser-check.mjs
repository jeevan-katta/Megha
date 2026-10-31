import { chromium, expect } from '@playwright/test';
const web = process.env.WEB_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  let documents = 0;
  let catalogueReads = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.resourceType() === 'document') documents++;
    if (request.url().endsWith('/api/v1/catalogue')) catalogueReads++;
  });
  await page.goto(web);
  await page.getByRole('button', { name: 'Add Pressure Switch to cart', exact: true }).click();
  await page.locator('header a[href="/cart"]').click();
  await expect(page.getByRole('heading', { name: 'Your Cart (1 Items)' })).toBeVisible();
  let finalTotal;
  await page.route('**/api/v1/checkout/validate', async (route) => {
    const quantity = route.request().postDataJSON().items[0].quantity;
    const response = await route.fetch();
    const body = await response.json();
    if (quantity === 4) finalTotal = body.data.total;
    // Simulate the older quote finishing later than the current quote.
    await new Promise((resolve) => setTimeout(resolve, quantity === 2 ? 350 : 20));
    await route.fulfill({ response }).catch(() => {});
  });
  for (let i = 0; i < 3; i++)
    await page.getByRole('button', { name: 'Increase Pressure Switch', exact: true }).click();
  await expect(page.locator('.cart-row .quantity span')).toHaveText('4');
  await expect.poll(() => finalTotal).toBeDefined();
  const expected = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(finalTotal / 100);
  await expect(page.locator('.summary-total strong').last()).toHaveText(expected);
  await page.waitForTimeout(400);
  await expect(page.locator('.summary-total strong').last()).toHaveText(expected);
  await page.getByRole('textbox', { name: 'Search spare parts', exact: true }).fill('pressure');
  await page.getByRole('textbox', { name: 'Search spare parts', exact: true }).press('Enter');
  await expect(page.locator('.catalogue-products .product-card')).toHaveCount(1);
  await page
    .getByRole('textbox', { name: 'Filter parts', exact: true })
    .fill('no-match-performance-check');
  await expect(page.getByRole('heading', { name: 'No matching parts found' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Filter parts', exact: true }).fill('');
  await page
    .getByRole('combobox', { name: 'Sort products', exact: true })
    .selectOption('price-asc');
  const prices = await page.locator('.catalogue-products .price').allTextContents();
  const values = prices.map((value) => Number(value.replace(/[^\d.]/g, '')));
  expect(values).toEqual([...values].sort((a, b) => a - b));
  await page.locator('.catalogue-products .product-card a').first().click();
  await expect(page.locator('.detail-layout h1')).toBeVisible();
  expect(documents).toBe(1);
  expect(catalogueReads).toBe(1);
  expect(errors).toEqual([]);
  console.log(
    'Performance browser checks passed: search/filter/sort, product detail, rapid cart actions with out-of-order quotes, one catalogue read, no full-page reloads.',
  );
} finally {
  await browser.close();
}
