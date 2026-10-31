import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { DomainError } from '../../shared/errors/domain-error';
import { validSignature } from '../../shared/security/signature';
import { Order } from '../orders/order.model';
import { capture } from '../payments/payment-capture.service';
import {
  providerPaymentSchema,
  validateCapturedPayment,
} from '../payments/payment-reconciliation.service';
import { notifyOnce } from '../notifications/notification.service';
import { applyRefundStatus } from '../refunds/refund.service';
import { Event } from './webhook-event.model';
export const razorpayWebhookRoutes = Router();
razorpayWebhookRoutes.post('/', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new DomainError('WEBHOOK_NOT_CONFIGURED', 'Webhook is not configured.', 503);
  if (
    !Buffer.isBuffer(req.body) ||
    !validSignature(req.body, req.get('x-razorpay-signature') ?? '', secret)
  )
    throw new DomainError('INVALID_SIGNATURE', 'Invalid webhook signature.', 401);
  const bodyHash = createHash('sha256').update(req.body).digest('hex');
  const input = z
    .object({
      event: z.string().max(100),
      payload: z
        .object({
          payment: z.object({ entity: providerPaymentSchema }).optional(),
          refund: z.object({ entity: z.object({ id: z.string(), status: z.string() }) }).optional(),
        })
        .passthrough(),
    })
    .parse(JSON.parse(req.body.toString('utf8')));
  const key =
    'razorpay:' +
    z
      .string()
      .min(1)
      .max(200)
      .parse(req.get('x-razorpay-event-id') ?? bodyHash);
  try {
    await Event.updateOne(
      { key },
      {
        $setOnInsert: { key, provider: 'razorpay', event: input.event, bodyHash, processed: false },
      },
      { upsert: true },
    );
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  const event = await Event.findOne({ key });
  if (!event || event.bodyHash !== bodyHash)
    throw new DomainError('EVENT_CONFLICT', 'Webhook event data does not match.', 409);
  if (event.processed) {
    res.json({ data: { received: true, duplicate: true } });
    return;
  }
  if (['payment.captured', 'order.paid'].includes(input.event)) {
    const payment = input.payload.payment?.entity;
    if (!payment) throw new DomainError('INVALID_EVENT', 'Captured payment details are missing.');
    const order = await Order.findOne({
      providerOrderId: payment.order_id,
      paymentProvider: 'razorpay',
    });
    if (!order)
      throw new DomainError('ORDER_NOT_FOUND', 'Payment order has not been recorded yet.', 409);
    validateCapturedPayment(payment, order);
    await capture(String(order._id), payment.id);
    event.orderId = String(order._id);
    event.paymentId = payment.id;
  }
  if (input.event === 'payment.failed' && input.payload.payment) {
    // Keep the order; the customer can retry while the reservation lasts.
    const payment = input.payload.payment.entity;
    const order = await Order.findOne({
      providerOrderId: payment.order_id,
      paymentProvider: 'razorpay',
      status: 'PENDING_PAYMENT',
    });
    if (order && order.paymentStatus !== 'CAPTURED') {
      order.paymentStatus = 'FAILED';
      order.history.push({
        status: 'PAYMENT_FAILED',
        at: new Date(),
        actor: 'system',
        description: 'Payment attempt failed',
      });
      await order.save();
      await notifyOnce(
        String(order.userId),
        'order:' + order.number + ':PAYMENT_FAILED:' + payment.id,
        'Payment failed · ' + order.number,
        'Your payment did not go through. You can retry from your order.',
        { orderId: String(order._id) },
      );
      event.orderId = String(order._id);
    }
  }
  if (['refund.processed', 'refund.failed'].includes(input.event) && input.payload.refund) {
    const refund = input.payload.refund.entity;
    const updated = await applyRefundStatus(refund.id, refund.status);
    if (updated) event.orderId = updated.orderId;
  }
  event.processed = true;
  event.processedAt = new Date();
  await event.save();
  res.json({ data: { received: true } });
});
