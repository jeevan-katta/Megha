'use client';

import { PageTitle } from '@/components/layout/page-title';
import { Img } from '@/components/ui/image';
import { Login } from '@/features/auth/login-form';
import { Summary } from '@/features/checkout/order-summary';
import { OrderPaymentActions } from '@/features/payments/order-payment-actions';
import { api } from '@/lib/api-client';
import { money } from '@/lib/format';
import { useStore } from '@/providers/store-provider';
import { type Address, type Order } from '@megha/types';
import {
  CheckCircle2,
  LifeBuoy,
  MapPin,
  Package,
  Printer,
  RotateCcw,
  ShoppingCart,
  Truck,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  deliveryText,
  orderStatusText,
  paymentStatusText,
  stagesDone,
  trackingStages,
} from './order-status';

const date = (value?: string | null, withTime = false) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '—';
const addressLines = (address?: Address) =>
  address
    ? [
        address.line1,
        address.line2,
        address.city + ', ' + address.state + ' – ' + address.pincode,
      ].filter(Boolean)
    : [];

export function OrderPage() {
  const path = usePathname();
  const { user, authLoading } = useStore();
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState('');
  const reference = path.split('/').at(-1) ?? '';
  const success = path.startsWith('/order/success/');
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    // Track links may use the order number; success links use the internal id.
    const url = /^[a-f0-9]{24}$/.test(reference)
      ? '/orders/' + reference
      : '/orders/track/' + encodeURIComponent(reference);
    api<Order>(url, undefined, 'GET', controller.signal)
      .then(setOrder)
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [user, reference]);
  if (authLoading)
    return (
      <div className="container page" role="status">
        Loading account…
      </div>
    );
  if (!user)
    return (
      <div className="container page">
        <Login />
      </div>
    );
  if (error)
    return (
      <div className="container page">
        <PageTitle title="Order" />
        <p className="error">{error}</p>
      </div>
    );
  if (!order)
    return (
      <div className="container page" role="status">
        Loading order…
      </div>
    );
  const paid = ['CAPTURED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(
    order.paymentStatus,
  );
  const done = stagesDone(order);
  const etaDays = order.shippingService?.etaDays;
  const estimated =
    order.shipment?.expectedDeliveryAt ??
    (etaDays && order.confirmedAt
      ? new Date(new Date(order.confirmedAt).getTime() + etaDays * 86400000).toISOString()
      : null);
  return (
    <div className="container page order-view">
      <PageTitle title={success && paid ? 'Order Confirmed' : 'Order ' + order.number} />
      {success && paid && (
        <section className="panel order-confirmed">
          <CheckCircle2 size={36} />
          <div>
            <h2>Thank you, your order is confirmed</h2>
            <p>
              Order <strong>{order.number}</strong> · Amount paid{' '}
              <strong>{money(order.total)}</strong>
              {estimated && <> · Estimated delivery {date(estimated)}</>}
            </p>
            <p className="muted">Delivering to {addressLines(order.address).join(', ')}</p>
          </div>
          <div className="order-actions">
            <Link className="button secondary" href={'/track/' + order.number}>
              <Truck size={16} /> Track Order
            </Link>
            <Link className="button" href="/spare-parts">
              Continue Shopping
            </Link>
          </div>
        </section>
      )}
      {order.status === 'CANCELLED' && (
        <div className="order-notice" role="status">
          <p>
            {order.paymentStatus === 'REFUND_REQUIRED' || paid
              ? 'This order was cancelled. Your payment is being refunded to your original payment method.'
              : order.cancelledBy === 'customer'
                ? 'You cancelled this order. No payment was taken and the items have been released.'
                : order.cancelledBy === 'store'
                  ? 'This order was cancelled by our team. No payment was taken. Please contact us if you have any questions.'
                  : 'This order was cancelled automatically because payment was not completed within 30 minutes. The reserved items have been released.'}
          </p>
          <Link href="/spare-parts">Shop spare parts again</Link>
        </div>
      )}
      <div className="order-status-strip panel">
        <div>
          <span>Order</span>
          <strong>{orderStatusText[order.status] ?? order.status}</strong>
        </div>
        <div>
          <span>Payment</span>
          <strong>{paymentStatusText[order.paymentStatus] ?? order.paymentStatus}</strong>
        </div>
        <div>
          <span>Delivery</span>
          <strong>{deliveryText(order)}</strong>
        </div>
        <div>
          <span>Placed</span>
          <strong>{date(order.createdAt)}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>{money(order.total)}</strong>
        </div>
      </div>
      <OrderPaymentActions order={order} onUpdated={setOrder} />
      <div className="checkout-layout">
        <div className="order-main">
          {!['PENDING_PAYMENT', 'CANCELLED'].includes(order.status) && (
            <section className="panel" id="tracking">
              <h2>
                <Truck size={20} /> Tracking
              </h2>
              <ol className="order-stages">
                {trackingStages.map((stage, index) => (
                  <li
                    key={stage}
                    className={index < done ? 'done' : index === done ? 'current' : ''}
                  >
                    <span aria-hidden="true">
                      {index < done ? '✓' : index === done ? '●' : '○'}
                    </span>
                    {stage}
                  </li>
                ))}
              </ol>
              {[
                'NDR',
                'DELIVERY_EXCEPTION',
                'RTO_INITIATED',
                'RTO_IN_TRANSIT',
                'RTO_DELIVERED',
              ].includes(order.shipment?.status ?? '') && (
                <p className="order-notice">
                  {deliveryText(order)}. Our team is following up and will contact you.
                </p>
              )}
              <dl className="order-facts">
                <div>
                  <dt>Courier</dt>
                  <dd>{order.shipment?.courierName ?? 'Assigned when your parcel is ready'}</dd>
                </div>
                <div>
                  <dt>AWB / Tracking number</dt>
                  <dd className="mono">{order.shipment?.awb ?? '—'}</dd>
                </div>
                <div>
                  <dt>Estimated delivery</dt>
                  <dd>
                    {order.deliveredAt
                      ? 'Delivered ' + date(order.deliveredAt)
                      : estimated
                        ? date(estimated)
                        : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Latest update</dt>
                  <dd>
                    {order.shipment?.lastEvent
                      ? `${order.shipment.lastEvent.activity}${order.shipment.lastEvent.location ? ' · ' + order.shipment.lastEvent.location : ''} · ${date(order.shipment.lastEvent.at, true)}`
                      : '—'}
                  </dd>
                </div>
              </dl>
              {!!order.trackingEvents?.length && (
                <ol className="order-events">
                  {order.trackingEvents.map((event, index) => (
                    <li key={index}>
                      <strong>{event.activity || 'Update'}</strong>
                      <small>
                        {event.location ? event.location + ' · ' : ''}
                        {date(event.at, true)}
                      </small>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
          <section className="panel">
            <h2>
              <Package size={20} /> Items
            </h2>
            {order.items.map((item) => (
              <div className="order-item" key={item.productId}>
                <Img src={item.image || '/assets/part-0.webp'} alt={item.name} />
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    SKU {item.sku}
                    {item.partNumber ? ' · Part ' + item.partNumber : ''}
                  </small>
                </div>
                <span>× {item.quantity}</span>
                <strong>{money(item.total)}</strong>
              </div>
            ))}
            <OrderActions order={order} />
          </section>
          <div className="order-columns">
            <section className="panel">
              <h2>
                <MapPin size={20} /> Shipping address
              </h2>
              <p>
                {order.customer.name}
                <br />
                {addressLines(order.address).map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
                {order.customer.phone}
              </p>
            </section>
            <section className="panel">
              <h2>Billing &amp; GST</h2>
              <p>
                {order.customer.company && (
                  <>
                    {order.customer.company}
                    <br />
                  </>
                )}
                GSTIN: {order.customer.gstin || '—'}
                <br />
                {addressLines(order.billingAddress ?? order.address).join(', ')}
              </p>
            </section>
          </div>
          {!!order.returns?.length && (
            <section className="panel">
              <h2>Returns</h2>
              {order.returns.map((entry) => (
                <div className="record-row" key={entry._id}>
                  <strong>{entry.number}</strong>
                  <p>
                    {entry.items.map((item) => item.name + ' × ' + item.quantity).join(', ')} ·{' '}
                    {entry.reason.replaceAll('_', ' ').toLowerCase()}
                  </p>
                  <span className="badge">{entry.status.replaceAll('_', ' ').toLowerCase()}</span>
                </div>
              ))}
            </section>
          )}
          {['DELIVERED', 'RETURN_REQUESTED'].includes(order.status) && (
            <ReturnRequest order={order} onDone={setOrder} />
          )}
        </div>
        <div>
          <Summary totals={order} />
          <section className="panel order-payment">
            <h2>Payment</h2>
            <p>
              {paymentStatusText[order.paymentStatus] ?? order.paymentStatus}
              {order.providerPaymentId && !order.providerPaymentId.startsWith('dev-') && (
                <small className="mono"> · {order.providerPaymentId}</small>
              )}
            </p>
            {order.refunds?.map((refund) => (
              <p key={refund._id} className="muted">
                Refund {money(refund.amount)} ·{' '}
                {refund.status === 'PROCESSED'
                  ? 'completed ' + date(refund.processedAt)
                  : refund.status === 'FAILED'
                    ? 'failed, our team will retry'
                    : 'in progress'}
              </p>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function OrderActions({ order }: { order: Order }) {
  const { cart, setCart, notice } = useStore();
  function buyAgain() {
    const next = [...cart];
    for (const item of order.items) {
      const existing = next.find((entry) => entry.productId === item.productId);
      if (existing) existing.quantity = Math.min(100, existing.quantity + item.quantity);
      else next.push({ productId: item.productId, quantity: item.quantity });
    }
    setCart(next);
    notice('Items added to your cart. Prices and stock are confirmed at checkout.');
  }
  return (
    <div className="order-actions">
      {!['PENDING_PAYMENT', 'CANCELLED'].includes(order.status) && (
        <Link className="button secondary" href={'/track/' + order.number}>
          <Truck size={16} /> Track
        </Link>
      )}
      <button className="secondary" onClick={() => window.print()}>
        <Printer size={16} /> Invoice
      </button>
      <button className="secondary" onClick={buyAgain}>
        <ShoppingCart size={16} /> Buy Again
      </button>
      <Link
        className="button secondary"
        href={'/contact?order=' + encodeURIComponent(order.number)}
      >
        <LifeBuoy size={16} /> Support
      </Link>
    </div>
  );
}

const reasons = [
  ['DAMAGED', 'Arrived damaged'],
  ['WRONG_ITEM', 'Wrong item'],
  ['NOT_COMPATIBLE', 'Not compatible with my machine'],
  ['DEFECTIVE', 'Defective'],
  ['NO_LONGER_NEEDED', 'No longer needed'],
  ['OTHER', 'Other'],
] as const;
function ReturnRequest({ order, onDone }: { order: Order; onDone: (order: Order) => void }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [key] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const items = order.items
      .map((item) => ({
        productId: item.productId,
        quantity: Number(fields.get('qty-' + item.productId) || 0),
      }))
      .filter((item) => item.quantity > 0);
    if (!items.length) return setError('Choose at least one item to return.');
    setBusy(true);
    setError('');
    try {
      await api('/orders/' + order._id + '/returns', {
        items,
        reason: fields.get('reason'),
        comments: fields.get('comments') ?? '',
        idempotencyKey: key,
      });
      onDone(await api<Order>('/orders/' + order._id));
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <button className="secondary" onClick={() => setOpen(true)}>
        <RotateCcw size={16} /> Request a Return
      </button>
    );
  return (
    <form className="panel return-form" onSubmit={submit}>
      <h2>Request a return</h2>
      {order.items.map((item) => (
        <label key={item.productId}>
          {item.name} (bought {item.quantity})
          <input
            name={'qty-' + item.productId}
            type="number"
            min={0}
            max={item.quantity}
            defaultValue={0}
          />
        </label>
      ))}
      <label>
        Reason
        <select name="reason" required defaultValue="">
          <option value="" disabled>
            Select a reason
          </option>
          {reasons.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Comments (optional)
        <textarea name="comments" maxLength={2000} rows={3} />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="order-actions">
        <button disabled={busy}>{busy ? 'Submitting…' : 'Submit Return Request'}</button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>
          <XCircle size={16} /> Cancel
        </button>
      </div>
    </form>
  );
}
