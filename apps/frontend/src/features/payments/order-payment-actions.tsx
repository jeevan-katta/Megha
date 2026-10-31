'use client';
import { api } from '@/lib/api-client';
import type { Order } from '@megha/types';
import { useState } from 'react';
import { payOrder } from './pay-order';
export function OrderPaymentActions({
  order,
  onUpdated,
}: {
  order: Order;
  onUpdated: (order: Order) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function perform(action: 'pay' | 'check' | 'cancel') {
    setBusy(true);
    setError('');
    try {
      if (action === 'pay') onUpdated(await payOrder(order));
      else if (action === 'check') {
        const current = await api<Order>('/payments/reconcile', { orderId: order._id });
        onUpdated(current);
        if (current.paymentStatus !== 'CAPTURED')
          setError('Payment has not been captured yet. Please check again shortly.');
      } else {
        await api('/orders/' + order._id + '/cancel', {});
        onUpdated(await api<Order>('/orders/' + order._id));
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (order.status !== 'PENDING_PAYMENT') return null;
  // Past the reservation the order can no longer be paid; it is being confirmed and closed.
  const windowClosed =
    !!order.reservationExpires && new Date(order.reservationExpires).getTime() <= Date.now();
  return (
    <div className="section">
      <h3>Payment</h3>
      {windowClosed && (
        <p className="muted">
          The payment window for this order has closed. If you completed a payment, use Check
          Payment Status; otherwise this order will be cancelled automatically.
        </p>
      )}
      <div className="admin-actions">
        {!windowClosed && (
          <button disabled={busy} onClick={() => perform('pay')}>
            {busy ? 'Please wait…' : 'Retry Payment'}
          </button>
        )}
        {order.paymentProvider === 'razorpay' && order.providerOrderId ? (
          <button disabled={busy} className="secondary" onClick={() => perform('check')}>
            Check Payment Status
          </button>
        ) : (
          <button disabled={busy} className="secondary" onClick={() => perform('cancel')}>
            Cancel Unpaid Order
          </button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
