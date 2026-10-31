import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { calculate, type PricedProduct } from '../apps/api/src/modules/pricing/pricing.service';
import { checkTransition } from '../apps/api/src/shared/state/transition';
import { normalizeStatus } from '../apps/api/src/modules/shipments/tracking.service';
import { permitted } from '@megha/constants';
import { validSignature } from '../apps/api/src/shared/security/signature';
const product = {
  _id: 'p1',
  name: 'Part',
  price: 125000,
  gstRate: 18,
  stock: 10,
  reserved: 2,
  active: true,
  sku: 'TEST',
  image: '',
} satisfies PricedProduct;
test('authoritative totals merge lines and compute integer paise tax', () => {
  const total = calculate(
    [
      { productId: 'p1', quantity: 1 },
      { productId: 'p1', quantity: 2 },
    ],
    [product],
  );
  assert.equal(total.items.length, 1);
  assert.equal(total.subtotal, 375000);
  assert.equal(total.tax, 67500);
  assert.equal(total.total, 454500);
});
test('reserved units cannot be sold and fractional quantities are rejected', () => {
  assert.throws(
    () => calculate([{ productId: 'p1', quantity: 9 }], [product]),
    /insufficient stock/,
  );
  assert.throws(() => calculate([{ productId: 'p1', quantity: 1.5 }], [product]), /Quantity/);
  assert.throws(
    () =>
      calculate(
        [
          { productId: 'p1', quantity: 5 },
          { productId: 'p1', quantity: 4 },
        ],
        [product],
      ),
    /insufficient stock/,
  );
});
test('payment transitions cannot be assigned arbitrarily', () => {
  assert.throws(() => checkTransition('orders', 'PENDING_PAYMENT', 'PAID'), /Cannot change/);
  assert.throws(() => checkTransition('orders', 'PAID', 'DELIVERED'), /Cannot change/);
  // Shipped and delivered come only from courier tracking, never from a manual status change.
  assert.throws(() => checkTransition('orders', 'PACKED', 'SHIPPED'), /Cannot change/);
  checkTransition('orders', 'CONFIRMED', 'PROCESSING');
  checkTransition('orders', 'PROCESSING', 'PACKED');
});
test('courier status text normalizes to Megha shipment statuses', () => {
  const cases: [string, string | null][] = [
    ['PICKED UP', 'PICKED_UP'],
    ['In Transit', 'IN_TRANSIT'],
    ['SHIPPED', 'IN_TRANSIT'],
    ['Out For Delivery', 'OUT_FOR_DELIVERY'],
    ['DELIVERED', 'DELIVERED'],
    ['UNDELIVERED', 'NDR'],
    ['RTO INITIATED', 'RTO_INITIATED'],
    ['RTO IN TRANSIT', 'RTO_IN_TRANSIT'],
    ['RTO DELIVERED', 'RTO_DELIVERED'],
    ['PICKUP EXCEPTION', 'PICKUP_EXCEPTION'],
    ['Out For Pickup', 'PICKUP_SCHEDULED'],
    ['LOST', 'DELIVERY_EXCEPTION'],
    ['CANCELED', 'CANCELLED'],
    ['Some new courier text', null],
  ];
  for (const [raw, expected] of cases) assert.equal(normalizeStatus(raw), expected, raw);
});
test('role permissions deny customer and technician catalogue writes', () => {
  assert.equal(permitted('CUSTOMER', 'orders'), false);
  assert.equal(permitted('TECHNICIAN', 'products'), false);
  assert.equal(permitted('SALES', 'inventory'), false);
  assert.equal(permitted('INVENTORY_MANAGER', 'inventory'), true);
});
test('HMAC validation rejects malformed signatures and modified payloads', () => {
  const signature = createHmac('sha256', 'test-secret').update('order|payment').digest('hex');
  assert.equal(validSignature('order|payment', signature, 'test-secret'), true);
  assert.equal(validSignature('order|other', signature, 'test-secret'), false);
  assert.equal(validSignature('order|payment', 'invalid', 'test-secret'), false);
  assert.equal(validSignature('order|payment', signature, ''), false);
});

test('unapproved pricing and invalid shipping cannot produce payable totals', () => {
  const items = [{ productId: 'p1', quantity: 1 }];
  assert.throws(() => calculate(items, [{ ...product, price: NaN }]), /approved pricing/);
  assert.throws(() => calculate(items, [{ ...product, gstRate: -1 }]), /approved pricing/);
  assert.throws(() => calculate(items, [product], -1), /shipping quote/);
  assert.throws(() => calculate(items, [product], 0.5), /shipping quote/);
});
