import { z } from 'zod';
import { razorpay } from '../../integrations/razorpay/razorpay.client';
import { DomainError } from '../../shared/errors/domain-error';
import { Order } from '../orders/order.model';
import { capture } from './payment-capture.service';
export const providerPaymentSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  order_id: z.string().nullable(),
  created_at: z.number().int().optional(),
});
export function validateCapturedPayment(
  payment: z.infer<typeof providerPaymentSchema>,
  order: { providerOrderId?: string | null; total?: number | null },
) {
  if (
    payment.order_id !== order.providerOrderId ||
    payment.amount !== order.total ||
    payment.currency !== 'INR'
  )
    throw new DomainError('PAYMENT_MISMATCH', 'Payment details do not match this order.', 409);
  if (payment.status !== 'captured')
    throw new DomainError(
      'PAYMENT_PENDING',
      'Payment is awaiting capture. Check again shortly.',
      409,
    );
}
async function providerPayments(providerOrderId: string) {
  const response = await razorpay<unknown>(
    'orders/' + encodeURIComponent(providerOrderId) + '/payments',
  );
  return z.object({ items: z.array(providerPaymentSchema) }).parse(response).items;
}
export async function reconcilePayment(orderId: string, userId?: string) {
  const order = await Order.findOne({ _id: orderId, ...(userId ? { userId } : {}) });
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found.', 404);
  if (order.paymentProvider !== 'razorpay' || !order.providerOrderId)
    throw new DomainError(
      'NO_PROVIDER_PAYMENT',
      'No Razorpay payment was initiated for this order.',
    );
  const payment = (await providerPayments(order.providerOrderId)).find(
    (item) => item.status === 'captured',
  );
  if (payment) {
    validateCapturedPayment(payment, order);
    await capture(String(order._id), payment.id);
  }
  return Order.findById(order._id);
}
/**
 * Settles an expired Razorpay order: records a captured payment, or reports whether a payment
 * is still in flight. Only UNPAID means Razorpay holds no money and the order is safe to cancel.
 */
export async function settleExpiredPayment(
  orderId: string,
  abandonedAfterSeconds = 15 * 60,
): Promise<'CAPTURED' | 'IN_PROGRESS' | 'UNPAID'> {
  const order = await Order.findById(orderId);
  if (!order?.providerOrderId) return 'UNPAID';
  const payments = await providerPayments(order.providerOrderId);
  const captured = payments.find((item) => item.status === 'captured');
  if (captured) {
    validateCapturedPayment(captured, order);
    await capture(String(order._id), captured.id);
    return 'CAPTURED';
  }
  // Authorized means the customer's money is held, so staff must decide. A 'created' attempt is
  // still live only briefly; older ones are abandoned checkouts and hold no money.
  const recent = Date.now() / 1000 - abandonedAfterSeconds;
  return payments.some(
    (item) =>
      item.status === 'authorized' ||
      (item.status === 'created' && (item.created_at ?? Date.now() / 1000) > recent),
  )
    ? 'IN_PROGRESS'
    : 'UNPAID';
}
