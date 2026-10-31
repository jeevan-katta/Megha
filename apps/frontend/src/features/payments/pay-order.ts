import { api } from '@/lib/api-client';
import type { Order } from '@megha/types';
import { openRazorpay, type PaymentSession } from './razorpay-checkout';
export async function payOrder(order: Order): Promise<Order> {
  const session = await api<PaymentSession>('/payments/order', { orderId: order._id });
  if (session.provider === 'development')
    return api<Order>('/payments/development/confirm', { orderId: order._id });
  const result = await openRazorpay(session, order.customer);
  if (result.razorpay_order_id !== session.providerOrderId)
    throw new Error('Payment order did not match. Please contact support.');
  return api<Order>('/payments/razorpay/verify', {
    orderId: order._id,
    razorpay_payment_id: result.razorpay_payment_id,
    razorpay_signature: result.razorpay_signature,
  });
}
