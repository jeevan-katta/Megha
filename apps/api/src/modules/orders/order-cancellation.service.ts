import mongoose from 'mongoose';
import { DomainError } from '../../shared/errors/domain-error';
import { Ledger } from '../inventory-transactions/inventory-transaction.model';
import { Product } from '../products/product.model';
import { Order } from './order.model';

/**
 * `paymentCheckedUnpaid` is set only by reservation expiry after Razorpay confirms that no payment
 * was captured or is still in progress for this order.
 */
export async function cancel(
  orderId: string,
  userId: string,
  admin = false,
  { paymentCheckedUnpaid = false, reason = 'Unpaid order cancelled' } = {},
) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, ...(admin ? {} : { userId }) }).session(
        session,
      );
      if (!order) throw new DomainError('ORDER_NOT_FOUND', 'Order not found.', 404);
      if (order.status === 'CANCELLED') return;
      if (order.status !== 'PENDING_PAYMENT')
        throw new DomainError(
          'CANCELLATION_REVIEW',
          'Paid orders require an admin refund review.',
          409,
        );
      if (
        (order.providerOrderId && !paymentCheckedUnpaid) ||
        (order.paymentLockUntil && order.paymentLockUntil > new Date())
      )
        throw new DomainError(
          'PAYMENT_REVIEW_REQUIRED',
          'Payment was initiated. Reconcile the payment before cancellation.',
          409,
        );
      for (const i of order.items) {
        const released = await Product.updateOne(
          { _id: i.productId, reserved: { $gte: i.quantity } },
          { $inc: { reserved: -i.quantity! } },
          { session },
        );
        if (!released.modifiedCount)
          throw new DomainError('INVENTORY_CONFLICT', 'Reserved stock requires review.', 409);
        await Ledger.create(
          [
            {
              key: orderId + ':release:' + i.productId,
              productId: i.productId,
              quantity: -i.quantity!,
              type: 'ORDER_RELEASED',
              reason,
              orderId,
            },
          ],
          { session },
        );
      }
      order.status = 'CANCELLED';
      order.history.push({
        status: 'CANCELLED',
        at: new Date(),
        actor: admin ? 'system' : 'customer',
        description: reason,
      });
      order.cancelledAt = new Date();
      order.cancelReason = reason;
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
}
