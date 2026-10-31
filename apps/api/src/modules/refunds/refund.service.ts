import { z } from 'zod';
import { config } from '../../config';
import { razorpay } from '../../integrations/razorpay/razorpay.client';
import { DomainError } from '../../shared/errors/domain-error';
import { audit } from '../audit/audit.service';
import { notifyOnce } from '../notifications/notification.service';
import { Order } from '../orders/order.model';
import { Refund } from './refund.model';

/** Paise as Indian rupees, e.g. ₹1,593.00. */
const inr = (paise: number) =>
  (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

const providerRefund = z.object({
  id: z.string(),
  status: z.string(),
  amount: z.number().int().optional(),
});
const refundStatus = (status: string) =>
  status === 'processed' ? 'PROCESSED' : status === 'failed' ? 'FAILED' : 'PENDING';

/** Recomputes the order's refund totals and statuses from its refund records. */
export async function syncOrderRefunds(orderId: string) {
  const order = await Order.findById(orderId);
  if (!order) return;
  const refunds = await Refund.find({ orderId }).lean();
  const processed = refunds
    .filter((refund) => refund.status === 'PROCESSED')
    .reduce((sum, refund) => sum + (refund.amount ?? 0), 0);
  const pending = refunds.some((refund) => refund.status === 'PENDING');
  const total = order.total ?? 0;
  const before = order.refundedAmount ?? 0;
  order.refundedAmount = processed;
  if (pending) order.paymentStatus = 'REFUND_PENDING';
  else if (processed >= total && total > 0) order.paymentStatus = 'REFUNDED';
  else if (processed > 0) order.paymentStatus = 'PARTIALLY_REFUNDED';
  // A cancelled order stays cancelled; otherwise the order reflects its refund state.
  if (order.status !== 'CANCELLED' && (pending || processed > 0)) {
    const next = pending
      ? 'REFUND_PENDING'
      : processed >= total
        ? 'REFUNDED'
        : 'PARTIALLY_REFUNDED';
    if (order.status !== next) {
      order.status = next;
      order.history.push({
        status: next,
        at: new Date(),
        actor: 'system',
        description: 'Refund status updated',
      });
    }
  }
  if (processed > before)
    order.history.push({
      status: 'REFUND_COMPLETED',
      at: new Date(),
      actor: 'system',
      description: inr(processed - before) + ' refunded',
    });
  await order.save();
  if (processed > before)
    await notifyOnce(
      String(order.userId),
      'order:' + order.number + ':refund:' + processed,
      'Refund completed · ' + order.number,
      inr(processed - before) + ' has been refunded to your original payment method.',
      { orderId },
    );
}

/** Refundable balance in paise: captured total less processed and pending refunds. */
export async function refundableAmount(orderId: string, total: number) {
  const refunds = await Refund.find({ orderId, status: { $in: ['PENDING', 'PROCESSED'] } }).lean();
  return total - refunds.reduce((sum, refund) => sum + (refund.amount ?? 0), 0);
}

/**
 * Issues a refund through Razorpay. The record is written before the provider call, keyed by the
 * caller's idempotency key, so retries never refund twice. Statuses come only from Razorpay.
 */
export async function requestRefund(
  orderId: string,
  input: { amount?: number; reason: string; idempotencyKey: string },
  actorId: string,
  extra: { returnId?: string; requestId?: string } = {},
) {
  const existing = await Refund.findOne({ idempotencyKey: input.idempotencyKey }).lean();
  if (existing) {
    if (existing.orderId !== orderId)
      throw new DomainError('IDEMPOTENCY_CONFLICT', 'This refund key was already used.', 409);
    return existing;
  }
  const order = await Order.findById(orderId).lean();
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found.', 404);
  if (
    !order.providerPaymentId ||
    !['CAPTURED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUND_REQUIRED'].includes(
      order.paymentStatus ?? '',
    )
  )
    throw new DomainError('NOT_REFUNDABLE', 'This order has no captured payment to refund.', 409);
  const refundable = await refundableAmount(orderId, order.total ?? 0);
  const amount = input.amount ?? refundable;
  if (amount < 100 || amount > refundable)
    throw new DomainError(
      'INVALID_REFUND_AMOUNT',
      'Refund must be between ₹1.00 and ' + inr(refundable) + '.',
    );
  let refund;
  try {
    refund = await Refund.create({
      orderId,
      orderNumber: order.number,
      returnId: extra.returnId,
      paymentId: order.providerPaymentId,
      amount,
      reason: input.reason,
      status: 'PENDING',
      requestedBy: actorId,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    return Refund.findOne({ idempotencyKey: input.idempotencyKey }).lean();
  }
  await audit(actorId, 'REFUND_REQUESTED', 'orders', orderId, input.reason, {
    after: { amount, refundId: String(refund._id) },
    requestId: extra.requestId,
  });
  try {
    if (order.providerPaymentId.startsWith('dev-')) {
      // Simulated payments can only be refunded locally, never in production.
      if (!config.development || config.payment !== 'development')
        throw new DomainError('NOT_REFUNDABLE', 'Simulated payments cannot be refunded here.', 409);
      refund.providerRefundId = 'dev-rfnd-' + String(refund._id);
      refund.status = 'PROCESSED';
      refund.processedAt = new Date();
    } else {
      const result = providerRefund.parse(
        await razorpay<unknown>(
          'payments/' + encodeURIComponent(order.providerPaymentId) + '/refund',
          {
            amount,
            receipt: String(refund._id),
            notes: { megha_order: order.number, megha_refund: String(refund._id) },
          },
        ),
      );
      refund.providerRefundId = result.id;
      refund.status = refundStatus(result.status);
      if (refund.status === 'PROCESSED') refund.processedAt = new Date();
    }
    await refund.save();
  } catch (error) {
    refund.status = 'FAILED';
    refund.failureReason = (error as Error).message.slice(0, 300);
    await refund.save();
    await syncOrderRefunds(orderId);
    throw error;
  }
  await syncOrderRefunds(orderId);
  return refund.toObject();
}

/** Applies a refund status reported by Razorpay (webhook or reconciliation). Idempotent. */
export async function applyRefundStatus(providerRefundId: string, status: string) {
  const refund = await Refund.findOne({ providerRefundId });
  if (!refund) return null;
  const next = refundStatus(status);
  if (refund.status !== next && refund.status !== 'PROCESSED') {
    refund.status = next;
    if (next === 'PROCESSED') refund.processedAt = new Date();
    await refund.save();
  }
  await syncOrderRefunds(refund.orderId);
  return refund;
}

/** Asks Razorpay for the current status of a pending refund. */
export async function reconcileRefund(refundId: string) {
  const refund = await Refund.findById(refundId);
  if (!refund?.providerRefundId || !refund.paymentId)
    throw new DomainError('NOT_FOUND', 'Refund has not reached the payment provider.', 404);
  if (refund.providerRefundId.startsWith('dev-')) return refund;
  const result = providerRefund.parse(
    await razorpay<unknown>(
      'payments/' +
        encodeURIComponent(refund.paymentId) +
        '/refunds/' +
        encodeURIComponent(refund.providerRefundId),
    ),
  );
  return applyRefundStatus(result.id, result.status);
}
