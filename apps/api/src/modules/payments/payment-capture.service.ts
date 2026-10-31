import mongoose from 'mongoose';
import { DomainError } from '../../shared/errors/domain-error';
import { Ledger } from '../inventory-transactions/inventory-transaction.model';
import { Order } from '../orders/order.model';
import { Product } from '../products/product.model';
import { notifyOnce } from '../notifications/notification.service';

export async function capture(orderId: string, paymentId: string) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new DomainError('ORDER_NOT_FOUND', 'Order not found.', 404);
      if (order.paymentStatus === 'CAPTURED') {
        if (order.providerPaymentId !== paymentId && !paymentId.startsWith('dev-'))
          throw new DomainError(
            'PAYMENT_CONFLICT',
            'A different payment is already recorded for this order.',
            409,
          );
        return;
      }
      // Money arrived after the reservation expired and stock was released: keep the payment on
      // record and flag the order for a staff refund instead of rejecting the webhook.
      if (order.status === 'CANCELLED') {
        // A replay of a payment already on this order (e.g. refunded after cancellation) is a no-op.
        if (order.providerPaymentId === paymentId || order.paymentStatus === 'REFUND_REQUIRED')
          return;
        order.paymentStatus = 'REFUND_REQUIRED';
        order.providerPaymentId = paymentId;
        order.history.push({
          status: 'PAID_AFTER_CANCELLATION',
          at: new Date(),
          actor: 'system',
          description: 'Payment arrived after cancellation; refund required',
        });
        await order.save({ session });
        await notifyOnce(
          String(order.userId),
          'order:' + order.number + ':PAID_AFTER_CANCELLATION',
          'Payment received for cancelled order ' + order.number,
          'This order was cancelled before your payment arrived. Our team will refund it.',
          { orderId },
          session,
        );
        return;
      }
      if (order.status !== 'PENDING_PAYMENT')
        throw new DomainError('INVALID_ORDER', 'This reservation is no longer payable.', 409);
      for (const item of order.items) {
        const r = await Product.updateOne(
          {
            _id: item.productId,
            stock: { $gte: item.quantity },
            reserved: { $gte: item.quantity },
          },
          { $inc: { stock: -item.quantity!, reserved: -item.quantity! } },
          { session },
        );
        if (!r.modifiedCount)
          throw new DomainError('INVENTORY_CONFLICT', 'Inventory requires review.', 409);
        await Ledger.create(
          [
            {
              key: orderId + ':commit:' + item.productId,
              productId: item.productId,
              quantity: -item.quantity!,
              type: 'ORDER_COMMITTED',
              reason: 'Verified payment',
              orderId,
            },
          ],
          { session },
        );
      }
      // Verified capture: the order is paid and immediately confirmed for fulfilment.
      const now = new Date();
      order.status = 'CONFIRMED';
      order.paymentStatus = 'CAPTURED';
      order.fulfilmentStatus = 'UNFULFILLED';
      order.providerPaymentId = paymentId;
      order.confirmedAt = now;
      order.history.push(
        { status: 'PAID', at: now, actor: 'system', description: 'Payment captured' },
        { status: 'CONFIRMED', at: now, actor: 'system', description: 'Order confirmed' },
      );
      await order.save({ session });
      await notifyOnce(
        String(order.userId),
        'order:' + order.number + ':CONFIRMED',
        'Order confirmed · ' + order.number,
        'Your payment was received and your order is confirmed.',
        { orderId },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
}
