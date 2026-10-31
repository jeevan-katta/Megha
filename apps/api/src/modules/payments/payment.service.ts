import { config } from '../../config';
import { razorpay } from '../../integrations/razorpay/razorpay.client';
import { DomainError } from '../../shared/errors/domain-error';
import { Order } from '../orders/order.model';

export async function preparePayment(orderId: string, userId: string) {
  if (!config.checkoutEnabled || config.payment === 'disabled')
    throw new DomainError('PAYMENT_DISABLED', 'Online payments are currently unavailable.', 503);
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) throw new DomainError('ORDER_NOT_FOUND', 'Order not found.', 404);
  if (order.status !== 'PENDING_PAYMENT')
    throw new DomainError('INVALID_ORDER', 'Order is not awaiting payment.', 409);
  if (order.paymentProvider !== config.payment)
    throw new DomainError(
      'PAYMENT_PROVIDER_CHANGED',
      'Please contact support for this order.',
      409,
    );
  if (!order.reservationExpires || order.reservationExpires.getTime() <= Date.now())
    throw new DomainError(
      'RESERVATION_EXPIRED',
      'The payment window for this order has closed. Please check out again.',
      409,
    );
  if (config.payment === 'development') {
    if (!config.development)
      throw new DomainError('PAYMENT_DISABLED', 'Development payments are disabled.', 403);
    return { provider: 'development', orderId: String(order._id), amount: order.total };
  }
  if (!order.providerOrderId) {
    const lease = new Date(Date.now() + 60000);
    const locked = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: 'PENDING_PAYMENT',
        providerOrderId: { $exists: false },
        $or: [{ paymentLockUntil: { $exists: false } }, { paymentLockUntil: { $lt: new Date() } }],
      },
      { $set: { paymentLockUntil: lease } },
      { new: true },
    );
    if (!locked)
      throw new DomainError(
        'PAYMENT_BUSY',
        'Payment is being prepared. Please retry in a moment.',
        409,
      );
    try {
      const result = await razorpay<{ id: string }>('orders', {
        amount: order.total,
        currency: 'INR',
        receipt: order.number,
        notes: { megha_order_id: String(order._id) },
      });
      const saved = await Order.findOneAndUpdate(
        { _id: order._id, paymentLockUntil: lease },
        { $set: { providerOrderId: result.id }, $unset: { paymentLockUntil: 1 } },
        { new: true },
      );
      if (!saved)
        throw new DomainError('PAYMENT_BUSY', 'Payment preparation needs reconciliation.', 409);
      order.providerOrderId = result.id;
    } catch (error) {
      await Order.updateOne(
        { _id: order._id, paymentLockUntil: lease },
        { $unset: { paymentLockUntil: 1 } },
      );
      throw error;
    }
  }
  return {
    provider: 'razorpay',
    key: process.env.RAZORPAY_KEY_ID,
    orderId: String(order._id),
    providerOrderId: order.providerOrderId,
    amount: order.total,
    currency: 'INR',
    testMode: process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') ?? false,
  };
}
