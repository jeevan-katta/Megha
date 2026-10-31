import { cancel } from '../modules/orders/order-cancellation.service';
import { Order } from '../modules/orders/order.model';
import { settleExpiredPayment } from '../modules/payments/payment-reconciliation.service';

/** A customer who opened Razorpay just before expiry may still finish paying in this window. */
export const PAYMENT_GRACE_MS = 15 * 60000;
const reason = 'Reservation expired before payment';
/** Razorpay is asked about an order at most this often, so page reads stay fast. */
const PROVIDER_RECHECK_MS = 5 * 60000;
const lastProviderCheck = new Map<string, number>();

/**
 * Cancels unpaid orders whose stock reservation has expired and releases the stock.
 * Bounded and restart-safe: run from the API's own timer, an authenticated scheduler, or on read.
 */
export async function maintainReservations(
  scope: { userId?: string } = {},
  { providerRecheckMs = PROVIDER_RECHECK_MS } = {},
) {
  const now = Date.now();
  const expired = await Order.find({
    ...scope,
    status: 'PENDING_PAYMENT',
    reservationExpires: { $lt: new Date(now) },
  })
    .sort({ reservationExpires: 1 })
    .limit(50);
  let released = 0,
    reconciled = 0,
    review = 0;
  for (const order of expired) {
    try {
      if (!order.providerOrderId) {
        await cancel(String(order._id), String(order.userId), true, { reason });
        released++;
        continue;
      }
      if (order.reservationExpires!.getTime() > now - PAYMENT_GRACE_MS) continue;
      const id = String(order._id);
      if (now - (lastProviderCheck.get(id) ?? 0) < providerRecheckMs) continue;
      lastProviderCheck.set(id, now);
      const payment = await settleExpiredPayment(String(order._id));
      if (payment === 'CAPTURED') reconciled++;
      else if (payment === 'IN_PROGRESS') review++;
      else {
        await cancel(String(order._id), String(order.userId), true, {
          paymentCheckedUnpaid: true,
          reason,
        });
        released++;
      }
    } catch (error) {
      // One order needing review must not stop the rest of the batch.
      review++;
      console.error('Reservation maintenance skipped order', String(order._id), error);
    }
  }
  for (const [id, at] of lastProviderCheck)
    if (now - at > PROVIDER_RECHECK_MS) lastProviderCheck.delete(id);
  return { released, reconciled, review };
}

/** Expire just one customer's overdue orders, so their order pages are always current. */
export const expireCustomerOrders = (userId: string) => maintainReservations({ userId });
