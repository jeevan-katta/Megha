import { randomUUID } from 'node:crypto';
import { config } from '../../config';
import { razorpay } from '../../integrations/razorpay/razorpay.client';
import { DomainError } from '../../shared/errors/domain-error';
import { validSignature } from '../../shared/security/signature';
import { orderRepository } from '../orders/order.repository';
import { capture } from './payment-capture.service';
import { providerPaymentSchema, validateCapturedPayment } from './payment-reconciliation.service';
export async function confirmDevelopment(orderId: string, userId: string) {
  if (!config.development || config.payment !== 'development')
    throw new DomainError('DISABLED', 'Development payments are disabled.', 403);
  const order = await orderRepository.owned(orderId, userId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found.', 404);
  if (order.paymentProvider !== 'development')
    throw new DomainError('FORBIDDEN', 'This order does not support simulated payment.', 403);
  if (
    order.paymentStatus !== 'CAPTURED' &&
    (!order.reservationExpires || order.reservationExpires.getTime() <= Date.now())
  )
    throw new DomainError('RESERVATION_EXPIRED', 'This reservation has expired.', 409);
  await capture(orderId, 'dev-' + randomUUID());
  return orderRepository.owned(orderId, userId);
}
export async function verifyPayment(
  input: { orderId: string; razorpay_payment_id: string; razorpay_signature: string },
  userId: string,
) {
  const order = await orderRepository.owned(input.orderId, userId);
  if (
    !order ||
    order.paymentProvider !== 'razorpay' ||
    !order.providerOrderId ||
    !validSignature(
      order.providerOrderId + '|' + input.razorpay_payment_id,
      input.razorpay_signature,
      process.env.RAZORPAY_KEY_SECRET || '',
    )
  )
    throw new DomainError('PAYMENT_VERIFICATION_FAILED', 'Unable to verify payment.');
  const payment = providerPaymentSchema.parse(
    await razorpay<unknown>('payments/' + encodeURIComponent(input.razorpay_payment_id)),
  );
  if (payment.id !== input.razorpay_payment_id)
    throw new DomainError('PAYMENT_MISMATCH', 'Payment identifier does not match.', 409);
  validateCapturedPayment(payment, order);
  await capture(input.orderId, input.razorpay_payment_id);
  return orderRepository.owned(input.orderId, userId);
}
