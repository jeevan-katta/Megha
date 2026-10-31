import { money } from '@/lib/format';
import { ChevronRight } from 'lucide-react';
import {
  cellValue,
  columnsFor,
  type AdminModule,
  type AdminRow,
  type Column,
} from './admin-config';

const tones: Record<string, string[]> = {
  success: [
    'PAID',
    'CAPTURED',
    'DELIVERED',
    'COMPLETED',
    'RESOLVED',
    'CONVERTED',
    'ACCEPTED',
    'ACTIVE',
    'PUBLISHED',
    'IDENTIFIED',
    'OK',
    'YES',
    'CREATE',
    'PRINTED',
    'PROCESSED',
  ],
  warning: [
    'PENDING_PAYMENT',
    'PENDING',
    'LOW',
    'WAITING_FOR_PARTS',
    'WAITING_FOR_CUSTOMER',
    'NEED_MORE_INFO',
    'NEGOTIATION',
    'RETURN_REQUESTED',
    'HIGH',
    'DRAFT',
    'UPDATE',
    'GENERATED',
    'READY_TO_SHIP',
    'REFUND_PENDING',
    'PARTIALLY_REFUNDED',
    'RETURN_REQUESTED',
    'REQUESTED',
  ],
  danger: [
    'CANCELLED',
    'FAILED',
    'RTO',
    'OUT_OF_STOCK',
    'LOST',
    'REJECTED',
    'EXPIRED',
    'URGENT',
    'INACTIVE',
    'RETURNED',
    'REFUND_REQUIRED',
    'PAID_AFTER_CANCELLATION',
    'DELIVERY_EXCEPTION',
    'NDR',
    'RTO_INITIATED',
    'RTO_IN_TRANSIT',
    'RTO_DELIVERED',
    'DELETE',
  ],
  info: [
    'NEW',
    'PROCESSING',
    'PACKED',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'CONTACTED',
    'QUOTE_PREPARED',
    'QUOTE_SENT',
    'ASSIGNED',
    'SCHEDULED',
    'IN_PROGRESS',
    'REVIEWING',
    'TRIAGED',
    'CONFIRMED',
    'PICKING',
    'CREATED',
    'COURIER_ASSIGNED',
    'AWB_GENERATED',
    'LABEL_GENERATED',
    'LABEL_PRINTED',
    'PICKUP_SCHEDULED',
    'PICKED_UP',
    'IN_TRANSIT',
    'APPROVED',
    'RECEIVED',
  ],
};
const labelOverrides: Record<string, string> = {
  OK: 'In stock',
  LOW: 'Low stock',
  NONE: 'No label',
  GENERATED: 'Awaiting print',
  PRINTED: 'Printed',
  NOT_CREATED: 'Ready to ship',
  CREATED: 'Shipment created',
  AWB_GENERATED: 'AWB generated',
  NOT_SCHEDULED: 'Not scheduled',
  RTO_INITIATED: 'RTO initiated',
  RTO_IN_TRANSIT: 'RTO in transit',
  RTO_DELIVERED: 'RTO delivered',
  RTO: 'RTO',
  NDR: 'NDR',
};
export function statusLabel(status: string) {
  if (labelOverrides[status]) return labelOverrides[status];
  const words = status.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
export function Badge({ status }: { status: string }) {
  const value = status.toUpperCase();
  const tone = Object.keys(tones).find((key) => tones[key].includes(value)) ?? 'neutral';
  return <span className={'adm-badge ' + tone}>{statusLabel(value)}</span>;
}
export function formatDate(value: unknown, withTime = false) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}
export function displayValue(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (
    typeof value === 'number' &&
    ['price', 'total', 'subtotal', 'tax', 'shipping', 'unitPrice', 'amount'].includes(key)
  )
    return money(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (['createdAt', 'updatedAt', 'reservationExpires', 'scheduledAt', 'validUntil'].includes(key))
    return formatDate(value, true);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
function Cell({ column, row }: { column: Column; row: AdminRow }) {
  const value = cellValue(row, column.key);
  switch (column.kind) {
    case 'image':
      return value ? (
        <img className="adm-thumb" src={String(value)} alt="" loading="lazy" />
      ) : (
        <span className="adm-thumb" />
      );
    case 'money':
      return <>{typeof value === 'number' ? money(value) : '—'}</>;
    case 'status':
    case 'stock':
      return value ? <Badge status={String(value)} /> : <>—</>;
    case 'boolean':
      return <Badge status={value === false ? 'INACTIVE' : 'ACTIVE'} />;
    case 'date':
      return <>{formatDate(value)}</>;
    case 'mono':
      return (
        <span className="adm-mono">{value == null || value === '' ? '—' : String(value)}</span>
      );
    default:
      return <>{value == null || value === '' ? '—' : String(value)}</>;
  }
}
export function AdminTable({
  module,
  rows,
  onSelect,
}: {
  module: AdminModule;
  rows: AdminRow[];
  onSelect: (row: AdminRow) => void;
}) {
  const columns = columnsFor(module);
  // On phones the first text column becomes the card title.
  const primary = columns.find((column) => column.kind !== 'image')?.key;
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={
                  (column.align === 'right' ? 'right ' : '') +
                  (column.kind === 'image' ? 'thumb' : '')
                }
              >
                {column.label}
              </th>
            ))}
            <th className="action">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={String(row._id ?? index)}
              tabIndex={0}
              onClick={() => onSelect(row)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSelect(row);
              }}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={column.label}
                  className={
                    (column.align === 'right' ? 'right ' : '') +
                    (column.kind === 'image' ? 'thumb ' : '') +
                    (column.key === primary ? 'primary' : '')
                  }
                >
                  <Cell column={column} row={row} />
                </td>
              ))}
              <td className="action">
                <ChevronRight size={16} aria-hidden="true" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
