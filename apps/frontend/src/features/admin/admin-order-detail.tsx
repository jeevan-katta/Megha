'use client';
import { api } from '@/lib/api-client';
import { money } from '@/lib/format';
import { useStore } from '@/providers/store-provider';
import { permitted } from '@megha/constants';
import { LoadingState } from '@megha/ui';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Printer, RefreshCw } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { AdminRow } from './admin-config';
import { Badge, formatDate, statusLabel } from './admin-table';

type Row = AdminRow & Record<string, unknown>;
interface Details {
  order: Row;
  shipments: Row[];
  events: Row[];
  refunds: Row[];
  returns: Row[];
  audits: Row[];
  actors: Record<string, string>;
}
interface Courier {
  courierId: number;
  name: string;
  rate: number;
  etaDays: number | null;
  mode: string;
  recommended: boolean;
}
const inCourierHands = [
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_EXCEPTION',
  'NDR',
  'RTO_INITIATED',
  'RTO_IN_TRANSIT',
  'RTO_DELIVERED',
];
const str = (value: unknown) => (value == null || value === '' ? '—' : String(value));

function Card({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <h2>{title}</h2>
        {actions}
      </header>
      <div className="adm-card-body">{children}</div>
    </section>
  );
}
function Fields({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="adm-fields single">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
const addressText = (value: unknown) => {
  const a = (value ?? {}) as Row;
  return [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ') || '—';
};

export function AdminOrderDetail({ orderId }: { orderId: string }) {
  const { user, notice } = useStore();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [couriers, setCouriers] = useState<Courier[] | null>(null);
  const details = useQuery({
    queryKey: ['private', user?._id, 'admin', 'orders', 'detail', orderId],
    queryFn: ({ signal }) =>
      api<Details>('/admin/orders/' + orderId + '/details', undefined, 'GET', signal),
  });
  if (details.isLoading) return <LoadingState>Loading order…</LoadingState>;
  if (details.error || !details.data)
    return (
      <p className="error" role="alert">
        {details.error?.message ?? 'Order not found.'}
      </p>
    );
  const { order, shipments, events, refunds, returns, audits, actors } = details.data;
  const shipment = shipments.find((entry) => entry.active) ?? shipments[0];
  const canShip = !!user && permitted(user.role, 'shipments');
  const canPay = !!user && permitted(user.role, 'payments');
  const actorName = (id: unknown) =>
    id === 'system' ? 'System' : id === 'customer' ? 'Customer' : (actors[String(id)] ?? str(id));
  const status = String(order.status);
  const sStatus = String(shipment?.status ?? '');
  const pickedUp = inCourierHands.includes(sStatus);

  async function run(label: string, path: string, body: unknown = {}) {
    setBusy(label);
    setError('');
    try {
      const result = await api<unknown>('/admin/orders/' + orderId + path, body, 'POST');
      notice(label + ' completed.');
      await details.refetch();
      return result;
    } catch (e) {
      setError((e as Error).message);
      await details.refetch();
    } finally {
      setBusy('');
    }
  }
  async function loadCouriers() {
    setBusy('Loading couriers');
    setError('');
    try {
      setCouriers(await api<Courier[]>('/admin/orders/' + orderId + '/couriers'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  function printLabel() {
    // Open the label inside the click so the browser allows the new tab, then record the print.
    window.open(String(shipment?.labelUrl), '_blank', 'noopener');
    void run(shipment?.labelPrinted ? 'Label reprint' : 'Label print', '/label/print');
  }
  const button = (label: string, onClick: () => void, primary = true) => (
    <button
      className={'adm-btn ' + (primary ? 'primary' : 'ghost')}
      disabled={!!busy}
      onClick={onClick}
    >
      {busy === label ? 'Working…' : label}
    </button>
  );

  // One clear next step for the current state.
  let primary: ReactNode = null;
  if (canShip) {
    if (['PAID', 'CONFIRMED'].includes(status))
      primary = button('Start Processing', () => void run('Processing', '/process'));
    else if (status === 'PACKED' && (!shipment || sStatus === 'NOT_CREATED'))
      primary = button('Create Shipment', () => void run('Shipment creation', '/shipment'));
    else if (sStatus === 'CREATED') primary = button('Choose Courier', () => void loadCouriers());
    else if (shipment?.awb && !shipment.labelUrl && !pickedUp)
      primary = button('Generate Label', () => void run('Label generation', '/label'));
    else if (shipment?.labelUrl && !shipment.labelPrinted && !pickedUp)
      primary = button('Print Label', printLabel);
    else if (
      shipment?.awb &&
      ['NOT_SCHEDULED', 'FAILED'].includes(String(shipment.pickupStatus)) &&
      !pickedUp
    )
      primary = button('Schedule Pickup', () => void run('Pickup scheduling', '/pickup'));
    else if (shipment?.awb && !['DELIVERED', 'RTO_DELIVERED', 'CANCELLED'].includes(sStatus))
      primary = button('Sync Tracking', () => void run('Tracking sync', '/tracking/sync'));
  }
  const retryPath: Record<string, [string, string]> = {
    shipment: ['Retry shipment creation', '/shipment'],
    label: ['Retry label', '/label'],
    pickup: ['Retry pickup', '/pickup'],
    tracking: ['Retry sync', '/tracking/sync'],
  };
  const lastError = shipment?.lastError as Row | undefined;
  const cancellable =
    ['PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'PROCESSING', 'PACKED'].includes(status) && !pickedUp;

  return (
    <div className="adm-detail">
      <div className="adm-detail-head">
        <div>
          <h1>Order #{str(order.number)}</h1>
          <div className="adm-detail-meta">
            <Badge status={status} />
            <Badge status={String(order.paymentStatus)} />
            {order.fulfilmentStatus ? <Badge status={String(order.fulfilmentStatus)} /> : null}
            {shipment && <Badge status={sStatus} />}
            <span>{str((order.customer as Row)?.name)}</span>
            <strong>{money(Number(order.total ?? 0))}</strong>
            <span>{formatDate(order.createdAt, true)}</span>
          </div>
        </div>
        <div className="adm-head-actions">
          <button className="adm-btn ghost" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          {primary}
        </div>
      </div>
      {error && (
        <p className="error adm-banner" role="alert">
          {error}
        </p>
      )}
      {lastError?.step ? (
        <div className="adm-banner warn" role="alert">
          <AlertTriangle size={18} />
          <span>
            <strong>{statusLabel(String(lastError.step))} step failed:</strong>{' '}
            {str(lastError.message)} · {formatDate(lastError.at, true)}
          </span>
          {canShip &&
            retryPath[String(lastError.step)] &&
            button(
              retryPath[String(lastError.step)][0],
              () =>
                void run(
                  retryPath[String(lastError.step)][0],
                  retryPath[String(lastError.step)][1],
                ),
            )}
        </div>
      ) : null}
      <div className="adm-detail-grid">
        <div className="adm-detail-main">
          <Card title="Items">
            <div className="adm-table-wrap">
              <table className="adm-table compact">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>SKU / Part</th>
                    <th className="right">Qty</th>
                    <th className="right">Unit</th>
                    <th className="right">GST</th>
                    <th className="right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {((order.items as Row[]) ?? []).map((item, index) => (
                    <tr key={String(item._id ?? index)}>
                      <td data-label="Item">{str(item.name)}</td>
                      <td data-label="SKU / Part">
                        <span className="adm-mono">
                          {str(item.sku)}
                          {item.partNumber ? ' · ' + item.partNumber : ''}
                        </span>
                      </td>
                      <td data-label="Qty" className="right">
                        {str(item.quantity)}
                      </td>
                      <td data-label="Unit" className="right">
                        {money(Number(item.unitPrice ?? 0))}
                      </td>
                      <td data-label="GST" className="right">
                        {money(Number(item.tax ?? 0))}
                      </td>
                      <td data-label="Total" className="right">
                        {money(Number(item.total ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {(status === 'PROCESSING' ||
            (status === 'PACKED' && (!shipment || sStatus === 'NOT_CREATED'))) &&
            canShip && (
              <PackingForm
                order={order}
                busy={busy}
                onSubmit={(body) =>
                  run(status === 'PROCESSING' ? 'Packing' : 'Package update', '/pack', body)
                }
              />
            )}
          {shipment && (
            <Card
              title="Shipment"
              actions={
                canShip && shipment.awb && !['CANCELLED'].includes(sStatus) ? (
                  <button
                    className="adm-btn ghost"
                    disabled={!!busy}
                    onClick={() => void run('Tracking sync', '/tracking/sync')}
                  >
                    <RefreshCw size={14} /> Sync
                  </button>
                ) : null
              }
            >
              <ol className="adm-steps">
                {[
                  [
                    'Packed',
                    !!(order.package as Row)?.packedAt,
                    (order.package as Row)?.weight
                      ? `${(order.package as Row).weight} kg · ${(order.package as Row).length}×${(order.package as Row).breadth}×${(order.package as Row).height} cm · ${(order.package as Row).count ?? 1} parcel(s)`
                      : '',
                  ],
                  [
                    'Shipment created',
                    !!shipment.shipmentCreatedAt,
                    shipment.providerShipmentId
                      ? 'Provider order ' +
                        str(shipment.providerOrderId) +
                        ' · shipment ' +
                        str(shipment.providerShipmentId)
                      : '',
                  ],
                  [
                    'Courier & AWB',
                    !!shipment.awb,
                    shipment.awb ? str(shipment.courierName) + ' · AWB ' + str(shipment.awb) : '',
                  ],
                  [
                    'Label generated',
                    !!shipment.labelUrl,
                    shipment.labelGeneratedAt ? formatDate(shipment.labelGeneratedAt, true) : '',
                  ],
                  [
                    'Label printed',
                    !!shipment.labelPrinted,
                    shipment.labelPrinted
                      ? `${str(shipment.labelPrintCount)} print(s) · last by ${actorName(shipment.labelPrintedBy)} ${formatDate(shipment.labelPrintedAt, true)}`
                      : '',
                  ],
                  [
                    'Pickup scheduled',
                    ['SCHEDULED', 'PICKED_UP'].includes(String(shipment.pickupStatus)),
                    shipment.pickupScheduledFor
                      ? formatDate(shipment.pickupScheduledFor) +
                        (shipment.pickupReference ? ' · ref ' + shipment.pickupReference : '')
                      : statusLabel(String(shipment.pickupStatus)),
                  ],
                  [
                    'Picked up',
                    !!shipment.pickedUpAt,
                    shipment.pickedUpAt ? formatDate(shipment.pickedUpAt, true) : '',
                  ],
                  [
                    'Delivered',
                    !!shipment.deliveredAt,
                    shipment.deliveredAt
                      ? formatDate(shipment.deliveredAt, true)
                      : shipment.expectedDeliveryAt
                        ? 'Expected ' + formatDate(shipment.expectedDeliveryAt)
                        : '',
                  ],
                ].map(([label, done, detail]) => (
                  <li key={String(label)} className={done ? 'done' : ''}>
                    <strong>{label as string}</strong>
                    {detail ? <small>{detail as string}</small> : null}
                  </li>
                ))}
              </ol>
              {shipment.lastEvent ? (
                <p className="adm-muted">
                  Last update: {str((shipment.lastEvent as Row).activity)} ·{' '}
                  {str((shipment.lastEvent as Row).location)} ·{' '}
                  {formatDate((shipment.lastEvent as Row).at, true)}
                </p>
              ) : null}
              {couriers && sStatus === 'CREATED' && (
                <CourierChooser
                  couriers={couriers}
                  busy={busy}
                  onAssign={(courierId) =>
                    run('Courier assignment', '/awb', courierId ? { courierId } : {}).then(() =>
                      setCouriers(null),
                    )
                  }
                />
              )}
              <div className="adm-inline-actions">
                {canShip && shipment.labelUrl && !pickedUp && shipment.labelPrinted
                  ? button('Reprint Label', printLabel, false)
                  : null}
                {canShip && shipment.labelUrl && pickedUp
                  ? button('Reprint Label', printLabel, false)
                  : null}
                {canShip && shipment.providerShipmentId && !pickedUp && sStatus !== 'CANCELLED' ? (
                  <ReasonAction
                    label="Cancel Shipment"
                    busy={busy}
                    onSubmit={(reason) =>
                      run('Shipment cancellation', '/shipment/cancel', { reason })
                    }
                  />
                ) : null}
              </div>
              {Array.isArray(shipment.labelPrints) && shipment.labelPrints.length > 0 && (
                <details className="adm-disclosure">
                  <summary>Label print history ({(shipment.labelPrints as Row[]).length})</summary>
                  <ul>
                    {(shipment.labelPrints as Row[]).map((print, index) => (
                      <li key={index}>
                        {print.reprint ? 'Reprint' : 'First print'} by {actorName(print.by)} ·{' '}
                        {formatDate(print.at, true)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          )}
          {canShip && ['NDR', 'DELIVERY_EXCEPTION'].includes(sStatus) && (
            <NdrPanel
              shipment={shipment!}
              busy={busy}
              actorName={actorName}
              onSubmit={(body) => run('NDR action', '/ndr', body)}
            />
          )}
          {canShip && sStatus === 'RTO_DELIVERED' && !(shipment?.rto as Row)?.inspectedAt && (
            <RtoPanel
              busy={busy}
              canRefund={canPay}
              onSubmit={(body) => run('RTO inspection', '/rto-inspection', body)}
            />
          )}
          {events.length > 0 && (
            <Card title="Tracking events">
              <ol className="adm-timeline">
                {events.map((event, index) => (
                  <li key={String(event._id ?? index)}>
                    <strong>
                      {event.normalizedStatus
                        ? statusLabel(String(event.normalizedStatus))
                        : str(event.providerStatus)}
                    </strong>
                    <small>
                      {str(event.activity)}
                      {event.location ? ' · ' + event.location : ''} · {formatDate(event.at, true)}{' '}
                      · {str(event.source)}
                    </small>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {returns.length > 0 && (
            <ReturnsPanel
              returns={returns}
              busy={busy}
              canShip={canShip}
              canPay={canPay}
              run={run}
            />
          )}
          <div className="adm-two">
            <Card title="Customer">
              <Fields
                items={[
                  ['Name', str((order.customer as Row)?.name)],
                  ['Email', str((order.customer as Row)?.email)],
                  ['Phone', str((order.customer as Row)?.phone)],
                  ['Company', str((order.customer as Row)?.company)],
                  ['GSTIN', str((order.customer as Row)?.gstin)],
                ]}
              />
            </Card>
            <Card title="Addresses">
              <Fields
                items={[
                  ['Shipping', addressText(order.address)],
                  ['Billing', addressText(order.billingAddress ?? order.address)],
                ]}
              />
            </Card>
          </div>
        </div>
        <aside className="adm-detail-side">
          <Card title="Summary">
            <dl className="adm-summary">
              <div>
                <dt>Subtotal</dt>
                <dd>{money(Number(order.subtotal ?? 0))}</dd>
              </div>
              <div>
                <dt>GST</dt>
                <dd>{money(Number(order.tax ?? 0))}</dd>
              </div>
              <div>
                <dt>
                  Shipping
                  {(order.shippingService as Row)?.label
                    ? ' · ' + (order.shippingService as Row).label
                    : ''}
                </dt>
                <dd>{money(Number(order.shipping ?? 0))}</dd>
              </div>
              <div className="total">
                <dt>Total</dt>
                <dd>{money(Number(order.total ?? 0))}</dd>
              </div>
            </dl>
          </Card>
          <Card title="Payment">
            <Fields
              items={[
                ['Status', <Badge key="s" status={String(order.paymentStatus)} />],
                ['Provider', str(order.paymentProvider)],
                [
                  'Payment ID',
                  <span key="p" className="adm-mono">
                    {str(order.providerPaymentId)}
                  </span>,
                ],
                ['Refunded', money(Number(order.refundedAmount ?? 0))],
              ]}
            />
            {refunds.length > 0 && (
              <ul className="adm-list-plain">
                {refunds.map((refund) => (
                  <li key={String(refund._id)}>
                    {money(Number(refund.amount))} <Badge status={String(refund.status)} />{' '}
                    <small>{str(refund.reason)}</small>
                    {canPay && refund.status === 'PENDING' && refund.providerRefundId ? (
                      <button
                        className="adm-link"
                        disabled={!!busy}
                        onClick={() =>
                          void run('Refund check', '/refunds/' + refund._id + '/reconcile')
                        }
                      >
                        Check status
                      </button>
                    ) : null}
                    {refund.failureReason ? (
                      <small className="adm-error-text">{str(refund.failureReason)}</small>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canPay &&
              ['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUND_PENDING', 'REFUND_REQUIRED'].includes(
                String(order.paymentStatus),
              ) && <RefundForm busy={busy} onSubmit={(body) => run('Refund', '/refunds', body)} />}
          </Card>
          {canPay && cancellable && (
            <Card title="Cancel order">
              <p className="adm-muted">
                {status === 'PENDING_PAYMENT'
                  ? 'Releases the reserved stock.'
                  : 'Cancels any shipment, returns stock and refunds the payment in full.'}
              </p>
              <ReasonAction
                label="Cancel Order"
                danger
                busy={busy}
                withKey
                onSubmit={(reason, idempotencyKey) =>
                  run('Order cancellation', '/cancel', { reason, idempotencyKey })
                }
              />
            </Card>
          )}
          <Card title="Timeline">
            <ol className="adm-timeline">
              {[...((order.history as Row[]) ?? [])].reverse().map((entry, index) => (
                <li key={index}>
                  <strong>{statusLabel(String(entry.status))}</strong>
                  <small>
                    {entry.description ? entry.description + ' · ' : ''}
                    {actorName(entry.actor ?? 'system')} · {formatDate(entry.at, true)}
                  </small>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Audit">
            {audits.length ? (
              <ul className="adm-list-plain">
                {audits.map((entry) => (
                  <li key={String(entry._id)}>
                    <strong>{statusLabel(String(entry.action))}</strong> ·{' '}
                    {actorName(entry.actorId)} · {formatDate(entry.createdAt, true)}
                    {entry.summary ? <small>{str(entry.summary)}</small> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="adm-muted">No staff actions yet.</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function PackingForm({
  order,
  busy,
  onSubmit,
}: {
  order: Row;
  busy: string;
  onSubmit: (body: unknown) => unknown;
}) {
  const current = (order.package ?? {}) as Row;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    void onSubmit({
      weight: Number(f.get('weight')),
      length: Number(f.get('length')),
      breadth: Number(f.get('breadth')),
      height: Number(f.get('height')),
      count: Number(f.get('count') || 1),
      notes: String(f.get('notes') ?? ''),
    });
  }
  const field = (name: string, label: string, step = '1', min = '1') => (
    <label>
      {label}
      <input
        name={name}
        type="number"
        step={step}
        min={min}
        required
        defaultValue={current[name] ? String(current[name]) : undefined}
      />
    </label>
  );
  return (
    <Card title={order.status === 'PROCESSING' ? 'Pack the order' : 'Package details'}>
      <form className="adm-form" onSubmit={submit}>
        <p className="adm-muted">
          Pick the items, verify quantities, pack, then record the final parcel. Couriers are
          requested only after this.
        </p>
        <div className="adm-form-grid four">
          {field('weight', 'Actual weight (kg)', '0.01', '0.05')}
          {field('length', 'Length (cm)')}
          {field('breadth', 'Width (cm)')}
          {field('height', 'Height (cm)')}
          {field('count', 'Package count')}
        </div>
        <label>
          Packing notes
          <textarea
            name="notes"
            rows={2}
            maxLength={1000}
            defaultValue={current.notes ? String(current.notes) : ''}
          />
        </label>
        <button className="adm-btn primary" disabled={!!busy}>
          {busy === 'Packing' || busy === 'Package update'
            ? 'Saving…'
            : order.status === 'PROCESSING'
              ? 'Mark Packed'
              : 'Update Package'}
        </button>
      </form>
    </Card>
  );
}

function CourierChooser({
  couriers,
  busy,
  onAssign,
}: {
  couriers: Courier[];
  busy: string;
  onAssign: (courierId?: number) => unknown;
}) {
  const [chosen, setChosen] = useState<number | undefined>(
    couriers.find((c) => c.recommended)?.courierId,
  );
  if (!couriers.length) return <p className="error">No courier can service this shipment.</p>;
  return (
    <div className="adm-couriers">
      {couriers.map((courier) => (
        <label key={courier.courierId} className={chosen === courier.courierId ? 'selected' : ''}>
          <input
            type="radio"
            name="courier"
            checked={chosen === courier.courierId}
            onChange={() => setChosen(courier.courierId)}
          />
          <span>
            <strong>{courier.name}</strong>
            {courier.recommended && <span className="adm-badge success">Recommended</span>}
            <small>
              {courier.mode === 'air' ? 'Air' : 'Surface'} ·{' '}
              {courier.etaDays ? courier.etaDays + ' days' : 'ETA unknown'}
            </small>
          </span>
          <b>{money(courier.rate)}</b>
        </label>
      ))}
      <div className="adm-inline-actions">
        <button
          className="adm-btn primary"
          disabled={!!busy || !chosen}
          onClick={() => void onAssign(chosen)}
        >
          {busy === 'Courier assignment' ? 'Assigning…' : 'Select Courier'}
        </button>
        <button
          className="adm-btn ghost"
          disabled={!!busy}
          onClick={() => void onAssign(undefined)}
        >
          Use Recommended
        </button>
      </div>
    </div>
  );
}

function ReasonAction({
  label,
  busy,
  danger = false,
  withKey = false,
  onSubmit,
}: {
  label: string;
  busy: string;
  danger?: boolean;
  withKey?: boolean;
  onSubmit: (reason: string, idempotencyKey: string) => unknown;
}) {
  const [open, setOpen] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  if (!open)
    return (
      <button
        className={'adm-btn ghost' + (danger ? ' danger' : '')}
        disabled={!!busy}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
    );
  return (
    <form
      className="adm-form adm-reason"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(String(new FormData(event.currentTarget).get('reason')), withKey ? key : '');
      }}
    >
      <label>
        Reason
        <input name="reason" required minLength={5} maxLength={1000} autoFocus />
      </label>
      <div className="adm-inline-actions">
        <button className={'adm-btn ' + (danger ? 'danger-solid' : 'primary')} disabled={!!busy}>
          Confirm {label}
        </button>
        <button type="button" className="adm-btn ghost" onClick={() => setOpen(false)}>
          Keep
        </button>
      </div>
    </form>
  );
}

function RefundForm({ busy, onSubmit }: { busy: string; onSubmit: (body: unknown) => unknown }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  if (!open)
    return (
      <button className="adm-btn ghost" onClick={() => setOpen(true)}>
        Issue Refund
      </button>
    );
  return (
    <form
      className="adm-form adm-reason"
      onSubmit={async (event) => {
        event.preventDefault();
        const f = new FormData(event.currentTarget);
        const rupees = Number(f.get('amount') || 0);
        await onSubmit({
          ...(rupees ? { amount: Math.round(rupees * 100) } : {}),
          reason: String(f.get('reason')),
          idempotencyKey: key,
        });
        setKey(crypto.randomUUID());
        setOpen(false);
      }}
    >
      <label>
        Amount (₹, blank for full balance)
        <input name="amount" type="number" min="1" step="0.01" />
      </label>
      <label>
        Reason
        <input name="reason" required minLength={5} maxLength={500} />
      </label>
      <div className="adm-inline-actions">
        <button className="adm-btn primary" disabled={!!busy}>
          Refund via Razorpay
        </button>
        <button type="button" className="adm-btn ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function NdrPanel({
  shipment,
  busy,
  actorName,
  onSubmit,
}: {
  shipment: Row;
  busy: string;
  actorName: (id: unknown) => string;
  onSubmit: (body: unknown) => unknown;
}) {
  const ndr = (shipment.ndr ?? {}) as Row;
  return (
    <Card title="Delivery exception">
      <Fields
        items={[
          ['Courier / AWB', str(shipment.courierName) + ' · ' + str(shipment.awb)],
          ['Reason', str(ndr.reason)],
          ['Attempts', str(ndr.attempts)],
          ['Last attempt', formatDate(ndr.lastAttemptAt, true)],
        ]}
      />
      {Array.isArray(ndr.actions) && ndr.actions.length > 0 && (
        <ul className="adm-list-plain">
          {(ndr.actions as Row[]).map((action, index) => (
            <li key={index}>
              <strong>{statusLabel(String(action.action))}</strong> · {actorName(action.by)} ·{' '}
              {formatDate(action.at, true)}
              <small>{str(action.notes)}</small>
            </li>
          ))}
        </ul>
      )}
      <form
        className="adm-form"
        onSubmit={(event) => {
          event.preventDefault();
          const f = new FormData(event.currentTarget);
          void onSubmit({ action: f.get('action'), notes: f.get('notes') });
          event.currentTarget.reset();
        }}
      >
        <div className="adm-form-grid">
          <label>
            Action taken
            <select name="action" required>
              <option value="CONTACTED_CUSTOMER">Contacted customer</option>
              <option value="UPDATED_INSTRUCTIONS">Updated delivery instructions</option>
              <option value="RETRY_REQUESTED">Requested re-attempt</option>
              <option value="ESCALATED">Escalated to courier</option>
            </select>
          </label>
          <label>
            Notes
            <input name="notes" required minLength={3} maxLength={1000} />
          </label>
        </div>
        <button className="adm-btn primary" disabled={!!busy}>
          Record Action
        </button>
      </form>
      <p className="adm-muted">
        If the courier gives up, the RTO status will arrive automatically from tracking.
      </p>
    </Card>
  );
}

function RtoPanel({
  busy,
  canRefund,
  onSubmit,
}: {
  busy: string;
  canRefund: boolean;
  onSubmit: (body: unknown) => unknown;
}) {
  const [key] = useState(() => crypto.randomUUID());
  return (
    <Card title="Inspect returned parcel (RTO)">
      <form
        className="adm-form"
        onSubmit={(event) => {
          event.preventDefault();
          const f = new FormData(event.currentTarget);
          void onSubmit({
            goods: f.get('goods'),
            refund: f.get('refund') === 'on',
            notes: f.get('notes') ?? '',
            idempotencyKey: key,
          });
        }}
      >
        <p className="adm-muted">
          The parcel is back. Stock is not restocked until you inspect it.
        </p>
        <div className="adm-form-grid">
          <label>
            Goods
            <select name="goods" required>
              <option value="RESTOCK">Restock (good condition)</option>
              <option value="DAMAGED">Damaged (write off)</option>
              <option value="RESHIP">Reship to customer</option>
              <option value="NO_ACTION">No action</option>
            </select>
          </label>
          <label>
            Notes
            <input name="notes" maxLength={1000} />
          </label>
        </div>
        {canRefund && (
          <label className="check-label">
            <input type="checkbox" name="refund" /> Refund the customer in full
          </label>
        )}
        <button className="adm-btn primary" disabled={!!busy}>
          Record Inspection
        </button>
      </form>
    </Card>
  );
}

function ReturnsPanel({
  returns,
  busy,
  canShip,
  canPay,
  run,
}: {
  returns: Row[];
  busy: string;
  canShip: boolean;
  canPay: boolean;
  run: (label: string, path: string, body?: unknown) => Promise<unknown>;
}) {
  const [keys] = useState(() => new Map<string, string>());
  const keyFor = (id: string) => {
    if (!keys.has(id)) keys.set(id, crypto.randomUUID());
    return keys.get(id)!;
  };
  return (
    <Card title="Returns">
      {returns.map((entry) => {
        const id = String(entry._id);
        const base = '/returns/' + id;
        return (
          <div className="adm-return" key={id}>
            <div className="adm-return-head">
              <strong>{str(entry.number)}</strong>
              <Badge status={String(entry.status)} />
              <span className="adm-muted">
                {statusLabel(String(entry.reason))} · {formatDate(entry.createdAt, true)}
              </span>
            </div>
            <p>
              {((entry.items as Row[]) ?? [])
                .map((item) => `${str(item.name)} × ${str(item.quantity)}`)
                .join(', ')}
              {entry.comments ? ' · “' + entry.comments + '”' : ''}
            </p>
            {entry.status === 'REQUESTED' && (
              <div className="adm-inline-actions">
                <button
                  className="adm-btn primary"
                  disabled={!!busy}
                  onClick={() =>
                    void run('Return approval', base + '/decision', { decision: 'APPROVE' })
                  }
                >
                  Approve
                </button>
                <ReasonAction
                  label="Reject"
                  busy={busy}
                  onSubmit={(notes) =>
                    run('Return rejection', base + '/decision', { decision: 'REJECT', notes })
                  }
                />
              </div>
            )}
            {entry.status === 'APPROVED' && canShip && (
              <form
                className="adm-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const f = new FormData(event.currentTarget);
                  const items = ((entry.items as Row[]) ?? []).map((item) => ({
                    productId: String(item.productId),
                    quantity: Number(item.quantity),
                    condition: String(f.get('condition-' + item.productId)),
                  }));
                  void run('Return receipt', base + '/receive', {
                    items,
                    notes: String(f.get('notes') ?? ''),
                  });
                }}
              >
                {((entry.items as Row[]) ?? []).map((item) => (
                  <label key={String(item.productId)}>
                    {str(item.name)} × {str(item.quantity)}
                    <select name={'condition-' + item.productId}>
                      <option value="RESTOCK">Restock</option>
                      <option value="DAMAGED">Damaged</option>
                    </select>
                  </label>
                ))}
                <label>
                  Inspection notes
                  <input name="notes" maxLength={1000} />
                </label>
                <button className="adm-btn primary" disabled={!!busy}>
                  Record Receipt
                </button>
              </form>
            )}
            {entry.status === 'RECEIVED' && canPay && (
              <button
                className="adm-btn primary"
                disabled={!!busy}
                onClick={() =>
                  void run('Return refund', base + '/refund', { idempotencyKey: keyFor(id) })
                }
              >
                Refund Returned Items
              </button>
            )}
          </div>
        );
      })}
    </Card>
  );
}
