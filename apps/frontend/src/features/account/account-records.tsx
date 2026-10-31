'use client';
import { Empty } from '@/components/ui/empty-state';
import { api } from '@/lib/api-client';
import { money } from '@/lib/format';
import { useStore } from '@/providers/store-provider';
import type { RecordData } from '@megha/types';
import { ArrowRight, ShoppingCart, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { accountTabs } from './account-navigation';

/** Customer wording for request statuses; internal codes are never shown. */
const statusText: Record<string, string> = {
  NEW: 'Received',
  CONTACTED: 'We contacted you',
  QUOTE_PREPARED: 'Quote being prepared',
  QUOTE_SENT: 'Quote sent',
  NEGOTIATION: 'In discussion',
  ACCEPTED: 'Accepted',
  REJECTED: 'Declined',
  EXPIRED: 'Quote expired',
  LOST: 'Closed',
  CLOSED: 'Closed',
  CONVERTED: 'Order placed',
  TRIAGED: 'Under review',
  ASSIGNED: 'Technician assigned',
  SCHEDULED: 'Visit scheduled',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_PARTS: 'Waiting for parts',
  WAITING_FOR_CUSTOMER: 'Waiting for your reply',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REVIEWING: 'Under review',
  NEED_MORE_INFO: 'More details needed',
  IDENTIFIED: 'Part identified',
  RESOLVED: 'Resolved',
};
const doneStatuses = ['COMPLETED', 'RESOLVED', 'CONVERTED', 'ACCEPTED'];
const date = (iso?: unknown) =>
  typeof iso === 'string'
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
/** Notifications are keyed like "order:MEGHA-2026-000002:DELIVERED"; link to that order. */
function notificationLink(record: RecordData) {
  if (typeof record.data.orderId === 'string') return '/track/' + record.data.orderId;
  const order = record.number?.match(/^order:([^:]+):/)?.[1];
  return order ? '/track/' + order : null;
}

export function AccountRecords({
  tab,
  records,
  onChange,
}: {
  tab: string;
  records: RecordData[];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const unread = records.filter((record) => record.status === 'UNREAD').length;
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel">
      <div className="records-head">
        <h2>{accountTabs.find((item) => item[1] === tab)?.[0] || tab}</h2>
        {tab === 'notifications' && unread > 0 && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void run(() => api('/me/notifications/read', {}))}
          >
            Mark all as read
          </button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {records.length ? (
        records.map((record) =>
          tab === 'notifications' ? (
            <Notification key={record._id} record={record} />
          ) : tab === 'saved' ? (
            <SavedItem
              key={record._id}
              record={record}
              busy={busy}
              onRemove={() => void run(() => api('/me/records/' + record._id, undefined, 'DELETE'))}
            />
          ) : (
            <Request key={record._id} record={record} />
          ),
        )
      ) : (
        <Empty
          title="Nothing here yet"
          text={
            tab === 'enquiries'
              ? 'Enquiries and quotation requests you send will appear here.'
              : tab === 'saved'
                ? 'Tap the heart on any part to save it here.'
                : tab === 'notifications'
                  ? 'Updates about your orders and requests will appear here.'
                  : 'Your requests will appear here.'
          }
        />
      )}
    </div>
  );
}

function Request({ record }: { record: RecordData }) {
  const totals = record.data.quoteTotals as { total?: number } | undefined;
  const lines = Array.isArray(record.data.quoteLines)
    ? (record.data.quoteLines as {
        description: string;
        quantity: number;
        unitPrice: number;
        gstRate: number;
      }[])
    : [];
  const status = record.status || 'NEW';
  return (
    <div className="record-row">
      <strong>{record.title}</strong>
      <p>{record.description}</p>
      {lines.length > 0 && (
        <table className="record-lines">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>GST</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td>{line.description}</td>
                <td>{line.quantity}</td>
                <td>{money(line.unitPrice)}</td>
                <td>{line.gstRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {totals?.total !== undefined && (
        <p className="record-quote">
          Quotation total (incl. GST): <strong>{money(totals.total)}</strong>
          {typeof record.data.validUntil === 'string' &&
            ' · valid until ' + date(record.data.validUntil)}
        </p>
      )}
      {typeof record.data.publicResponse === 'string' && record.data.publicResponse && (
        <p className="record-response">{record.data.publicResponse}</p>
      )}
      <span className={'badge' + (doneStatuses.includes(status) ? ' green' : '')}>
        {statusText[status] ?? status.replaceAll('_', ' ').toLowerCase()}
      </span>
      <small>
        Ref {record.number} · {date(record.createdAt)}
      </small>
    </div>
  );
}

function Notification({ record }: { record: RecordData }) {
  const href = notificationLink(record);
  const unread = record.status === 'UNREAD';
  return (
    <div className={'record-row notification' + (unread ? ' unread' : '')}>
      <strong>
        {unread && <i className="unread-dot" aria-label="Unread" />}
        {record.title}
      </strong>
      <p>{record.description}</p>
      <small>
        {date(record.createdAt)}
        {href && (
          <>
            {' · '}
            <Link href={href}>
              View order <ArrowRight size={12} />
            </Link>
          </>
        )}
      </small>
    </div>
  );
}

function SavedItem({
  record,
  busy,
  onRemove,
}: {
  record: RecordData;
  busy: boolean;
  onRemove: () => void;
}) {
  const { catalogue, add } = useStore();
  const product = catalogue.products.find((p) => p._id === record.data.productId);
  const available = product ? product.stock - product.reserved : 0;
  return (
    <div className="record-row saved-item">
      <div>
        {product ? (
          <Link href={'/product/' + product.slug}>
            <strong>{product.name}</strong>
          </Link>
        ) : (
          <strong>{record.title}</strong>
        )}
        <small>
          {product
            ? money(product.price) + ' · ' + (available > 0 ? 'In stock' : 'Out of stock')
            : 'No longer available'}
        </small>
      </div>
      <div className="saved-actions">
        {product && (
          <button className="secondary" disabled={available < 1} onClick={() => add(product)}>
            <ShoppingCart size={16} /> {available > 0 ? 'Add to Cart' : 'Out of Stock'}
          </button>
        )}
        <button
          className="text-button"
          disabled={busy}
          onClick={onRemove}
          aria-label={'Remove ' + (product?.name ?? record.title)}
        >
          <Trash2 size={16} /> Remove
        </button>
      </div>
    </div>
  );
}
