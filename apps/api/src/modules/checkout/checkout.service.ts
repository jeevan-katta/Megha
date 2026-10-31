import { type CartItem } from '@megha/types';
import { checkoutSchema } from '@megha/validation';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { config } from '../../config';
import { shipping } from '../../integrations/shiprocket';
import type { DeliveryOption } from '../../integrations/shiprocket/shipping.interface';
import { DomainError } from '../../shared/errors/domain-error';
import { nextNumber } from '../counters/counter.service';
import { Ledger } from '../inventory-transactions/inventory-transaction.model';
import { Order } from '../orders/order.model';
import { calculate } from '../pricing/pricing.service';
import { pricingProduct } from '../products/product.mapper';
import { Product } from '../products/product.model';
import { checkAddressPincode } from '../pincodes/pincode.service';

function requireCheckout() {
  if (!config.checkoutEnabled || config.payment === 'disabled')
    throw new DomainError(
      'CHECKOUT_DISABLED',
      'Online checkout is currently unavailable. Please send an enquiry.',
      503,
    );
}

type ProductRow = Awaited<ReturnType<typeof loadProducts>>[number];
const loadProducts = (items: CartItem[]) =>
  Product.find({ _id: { $in: items.map((item) => item.productId) } }).lean();

/** Delivery options for this cart, priced by the provider from weight and order value. */
async function optionsFor(pincode: string, items: CartItem[], products: ProductRow[]) {
  const totals = calculate(items, products.map(pricingProduct), 0);
  const weight = totals.items.reduce((sum, line) => {
    const product = products.find((p) => String(p._id) === line.productId);
    return sum + (product?.weight || config.defaultItemWeightKg) * line.quantity;
  }, 0);
  return shipping.deliveryOptions(pincode, {
    weight: Math.max(0.05, Math.round(weight * 1000) / 1000),
    declaredValue: totals.subtotal + totals.tax,
  });
}

export async function deliveryOptions(pincode: string, items: CartItem[]) {
  requireCheckout();
  const options = await optionsFor(pincode, items, await loadProducts(items));
  if (!options.length)
    throw new DomainError('UNSERVICEABLE', 'Delivery is not available to this PIN code yet.');
  // Customers see the delivery promise and price, not courier details.
  return options.map(({ service, label, amount, etaDays }) => ({
    service,
    label,
    amount,
    etaDays,
  }));
}

/** Server-side cart quote. With a PIN code, the chosen delivery option is priced in. */
export async function quoteCart(
  items: CartItem[],
  pincode?: string,
  service: 'standard' | 'express' = 'standard',
) {
  requireCheckout();
  const products = await loadProducts(items);
  if (!pincode)
    return { ...calculate(items, products.map(pricingProduct), 0), shippingQuoted: false };
  const option = pickOption(await optionsFor(pincode, items, products), service);
  return {
    ...calculate(items, products.map(pricingProduct), option.amount),
    shippingQuoted: true,
    shippingService: { service: option.service, label: option.label, etaDays: option.etaDays },
  };
}

function pickOption(options: DeliveryOption[], service: 'standard' | 'express') {
  const option = options.find((o) => o.service === service) ?? options[0];
  if (!option)
    throw new DomainError('UNSERVICEABLE', 'Delivery is not available to this PIN code yet.');
  return option;
}

export async function createOrder(userId: string, input: z.infer<typeof checkoutSchema>) {
  requireCheckout();
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const existing = await Order.findOne({ idempotencyKey: input.idempotencyKey, userId });
  if (existing) {
    if (existing.requestFingerprint && existing.requestFingerprint !== fingerprint)
      throw new DomainError(
        'IDEMPOTENCY_CONFLICT',
        'Checkout details changed. Please start a new checkout.',
        409,
      );
    return existing;
  }
  // The PIN code must exist and match the chosen state (skipped if the lookup is unavailable).
  await checkAddressPincode(input.address);
  if (input.billingAddress) await checkAddressPincode(input.billingAddress, ' (billing address)');
  // Price delivery from the server's own product data, never from the browser.
  const delivery = pickOption(
    await optionsFor(input.address.pincode, input.items, await loadProducts(input.items)),
    input.shippingService,
  );
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      const products = await Product.find({ _id: { $in: input.items.map((i) => i.productId) } })
        .session(session)
        .lean();
      if (!config.development && products.some((p) => p.developmentOnly))
        throw new DomainError(
          'MASTER_DATA_PENDING',
          'These products require approved commercial data.',
        );
      const totals = calculate(input.items, products.map(pricingProduct), delivery.amount);
      if (input.expectedTotal !== undefined && input.expectedTotal !== totals.total)
        throw new DomainError(
          'PRICE_CHANGED',
          'Prices have changed since you opened checkout. The new total is ' +
            (totals.total / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) +
            '. Please review it and press Pay again.',
          409,
        );
      const [record] = await Order.create(
        [
          {
            ...totals,
            // Immutable snapshots: later catalogue changes never alter a placed order.
            items: totals.items.map((line) => ({
              ...line,
              partNumber: products.find((p) => String(p._id) === line.productId)?.partNumber ?? '',
            })),
            userId,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: fingerprint,
            number: await nextNumber('MEGHA', session),
            customer: input.customer,
            address: input.address,
            billingAddress: input.billingAddress || input.address,
            shippingService: {
              service: delivery.service,
              label: delivery.label,
              amount: delivery.amount,
              etaDays: delivery.etaDays ?? undefined,
            },
            status: 'PENDING_PAYMENT',
            paymentStatus: 'PENDING',
            fulfilmentStatus: 'UNFULFILLED',
            paymentProvider: config.payment,
            reservationExpires: new Date(Date.now() + 30 * 60000),
            history: [
              {
                status: 'PENDING_PAYMENT',
                at: new Date(),
                actor: 'customer',
                description: 'Order created',
              },
            ],
          },
        ],
        { session },
      );
      order = record;
      for (const item of totals.items) {
        const updated = await Product.updateOne(
          {
            _id: item.productId,
            $expr: { $gte: [{ $subtract: ['$stock', '$reserved'] }, item.quantity] },
          },
          { $inc: { reserved: item.quantity } },
          { session },
        );
        if (!updated.modifiedCount)
          throw new DomainError('OUT_OF_STOCK', 'Stock changed. Please review your cart.', 409);
        await Ledger.create(
          [
            {
              key: String(record._id) + ':reserve:' + item.productId,
              productId: item.productId,
              quantity: item.quantity,
              type: 'ORDER_RESERVED',
              reason: 'Checkout reservation',
              actorId: userId,
              orderId: String(record._id),
            },
          ],
          { session },
        );
      }
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const previous = await Order.findOne({
      idempotencyKey: input.idempotencyKey,
      userId,
      requestFingerprint: fingerprint,
    });
    if (!previous)
      throw new DomainError('IDEMPOTENCY_CONFLICT', 'This checkout key was already used.', 409);
    order = previous;
  } finally {
    await session.endSession();
  }
  if (!order) throw new DomainError('ORDER_FAILED', 'Unable to create order.');
  return order;
}
