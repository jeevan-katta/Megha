import { money } from '@/lib/format';
import { Pencil, Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AdminModule, AdminRow } from './admin-config';
import { InventoryForm } from './admin-inventory-form';
import { AdminPaymentActions } from './admin-payment-actions';
import { Badge, displayValue, formatDate, statusLabel } from './admin-table';
import { WorkflowForm } from './admin-workflow-form';

const hidden = new Set([
  '_id',
  '__v',
  'idempotencyKey',
  'paymentLockUntil',
  'history',
  'items',
  'customer',
  'address',
  'billingAddress',
  'password',
  'kind',
  'quoteLines',
  'quoteTotals',
  'mergedFrom',
  // Already shown in the page header, or internal identifiers staff do not need.
  'number',
  'status',
  'paymentStatus',
  'createdAt',
  'ownerId',
  'userId',
  'actorId',
  'technicianId',
  'identifiedProductId',
]);
const labelOverrides: Record<string, string> = {
  sku: 'SKU',
  gstRate: 'GST rate',
  gstin: 'GSTIN',
  slug: 'URL slug',
  threshold: 'Low-stock level',
  developmentOnly: 'Sample product',
};
const fieldLabel = (key: string) => {
  if (labelOverrides[key]) return labelOverrides[key];
  const words = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Nested objects such as `data` are flattened so every field sits in one list. */
function flatten(row: AdminRow): [string, unknown][] {
  return Object.entries(row).flatMap(([key, value]): [string, unknown][] =>
    hidden.has(key) || value === '' || value == null
      ? []
      : typeof value === 'object' && !Array.isArray(value)
        ? flatten(value as AdminRow)
        : [[key, value]],
  );
}
function Details({ row }: { row: AdminRow }) {
  const entries = flatten(row);
  if (!entries.length) return <p className="adm-muted">No additional details.</p>;
  return (
    <dl className="adm-fields">
      {entries.map(([key, value], index) => (
        <div key={key + index}>
          <dt>{fieldLabel(key)}</dt>
          <dd>
            {key === 'status' || key === 'paymentStatus' ? (
              <Badge status={String(value)} />
            ) : Array.isArray(value) ? (
              value.length ? (
                value
                  .map((item) =>
                    item && typeof item === 'object'
                      ? Object.values(item as AdminRow).join(': ')
                      : String(item),
                  )
                  .join(', ')
              ) : (
                '—'
              )
            ) : (
              displayValue(key, value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="adm-card">
      <header>
        <h2>{title}</h2>
      </header>
      <div className="adm-card-body">{children}</div>
    </section>
  );
}
function Address({ value }: { value: unknown }) {
  const address = (value ?? {}) as AdminRow;
  const lines = [address.line1, address.line2, address.city, address.state, address.pincode]
    .filter(Boolean)
    .map(String);
  return lines.length ? <p className="adm-address">{lines.join(', ')}</p> : <p>—</p>;
}
function OrderItems({ row }: { row: AdminRow }) {
  const items = (Array.isArray(row.items) ? row.items : []) as AdminRow[];
  return (
    <div className="adm-table-wrap">
      <table className="adm-table compact">
        <thead>
          <tr>
            <th>Item</th>
            <th>SKU</th>
            <th className="right">Qty</th>
            <th className="right">Unit price</th>
            <th className="right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={String(item._id ?? index)}>
              <td data-label="Item">{String(item.name ?? '—')}</td>
              <td data-label="SKU">
                <span className="adm-mono">{String(item.sku ?? '—')}</span>
              </td>
              <td data-label="Qty" className="right">
                {String(item.quantity ?? '—')}
              </td>
              <td data-label="Unit price" className="right">
                {money(Number(item.unitPrice ?? 0))}
              </td>
              <td data-label="Total" className="right">
                {money(Number(item.total ?? 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Summary({ row }: { row: AdminRow }) {
  return (
    <dl className="adm-summary">
      {(['subtotal', 'tax', 'shipping'] as const).map((key) => (
        <div key={key}>
          <dt>{key === 'tax' ? 'GST' : fieldLabel(key)}</dt>
          <dd>{money(Number(row[key] ?? 0))}</dd>
        </div>
      ))}
      <div className="total">
        <dt>Total</dt>
        <dd>{money(Number(row.total ?? 0))}</dd>
      </div>
    </dl>
  );
}
function Timeline({ history }: { history: unknown }) {
  const events = (Array.isArray(history) ? history : []) as AdminRow[];
  if (!events.length) return <p className="adm-muted">No status changes yet.</p>;
  return (
    <ol className="adm-timeline">
      {[...events].reverse().map((event, index) => (
        <li key={index}>
          <strong>{statusLabel(String(event.status ?? ''))}</strong>
          <small>{formatDate(event.at, true)}</small>
        </li>
      ))}
    </ol>
  );
}

export function AdminRecordDetail({
  module,
  row,
  onSaved,
  onEdit,
}: {
  module: AdminModule;
  row: AdminRow;
  onSaved: () => void;
  onEdit?: () => void;
}) {
  const isOrder = ['orders', 'payments', 'shipments'].includes(module);
  const hasWorkflow = ['orders', 'enquiries', 'service-requests', 'find-my-spare'].includes(module);
  const customer = (row.customer ?? {}) as AdminRow;
  // Requests carry both a subject (title) and the customer's name; lead with the subject.
  const heading = String(
    isOrder
      ? 'Order #' + row.number
      : row.kind
        ? (row.title ?? row.name ?? row.number ?? 'Record')
        : (row.name ?? row.title ?? row.number ?? 'Record'),
  );
  return (
    <div className="adm-detail">
      <div className="adm-detail-head">
        <div>
          <h1>{heading}</h1>
          <div className="adm-detail-meta">
            {typeof row.status === 'string' && <Badge status={row.status} />}
            {typeof row.paymentStatus === 'string' && <Badge status={row.paymentStatus} />}
            {!isOrder && typeof row.number === 'string' && (
              <span className="adm-mono">{row.number}</span>
            )}
            {isOrder && typeof customer.name === 'string' && <span>{customer.name}</span>}
            {isOrder && <strong>{money(Number(row.total ?? 0))}</strong>}
            {typeof row.createdAt === 'string' && <span>{formatDate(row.createdAt, true)}</span>}
          </div>
        </div>
        <div className="adm-head-actions">
          <button className="adm-btn ghost" onClick={() => window.print()}>
            <Printer size={16} />
            Print
          </button>
          {onEdit && (
            <button className="adm-btn primary" onClick={onEdit}>
              <Pencil size={16} />
              Edit
            </button>
          )}
        </div>
      </div>
      <div className="adm-detail-grid">
        <div className="adm-detail-main">
          {isOrder ? (
            <>
              <Card title="Items">
                <OrderItems row={row} />
              </Card>
              <div className="adm-two">
                <Card title="Customer">
                  <dl className="adm-fields single">
                    {(['name', 'email', 'phone', 'company', 'gstin'] as const)
                      .filter((key) => customer[key])
                      .map((key) => (
                        <div key={key}>
                          <dt>{key === 'gstin' ? 'GSTIN' : fieldLabel(key)}</dt>
                          <dd>{String(customer[key])}</dd>
                        </div>
                      ))}
                  </dl>
                </Card>
                <Card title="Shipping address">
                  <Address value={row.address} />
                  <h3 className="adm-subhead">Billing address</h3>
                  <Address value={row.billingAddress ?? row.address} />
                </Card>
              </div>
            </>
          ) : module === 'inventory' ? (
            <>
              <InventoryForm row={row} onSaved={onSaved} />
              <Card title="Product">
                <Details
                  row={Object.fromEntries(
                    ['sku', 'partNumber', 'category', 'threshold', 'updatedAt'].map((key) => [
                      key,
                      row[key],
                    ]),
                  )}
                />
              </Card>
            </>
          ) : (
            <Card title="Details">
              <Details row={row} />
            </Card>
          )}
          {module === 'enquiries' && (
            <Card title="Workflow & quotation">
              <WorkflowForm module={module} row={row} onSaved={onSaved} />
            </Card>
          )}
        </div>
        <aside className="adm-detail-side">
          {isOrder && (
            <Card title="Summary">
              <Summary row={row} />
              <dl className="adm-fields single">
                <div>
                  <dt>Payment provider</dt>
                  <dd>{String(row.paymentProvider ?? '—')}</dd>
                </div>
              </dl>
            </Card>
          )}
          {module === 'payments' && (
            <Card title="Payment">
              <AdminPaymentActions row={row} onSaved={onSaved} />
            </Card>
          )}
          {hasWorkflow && module !== 'enquiries' && (
            <Card title={module === 'orders' ? 'Update status' : 'Workflow'}>
              <WorkflowForm module={module} row={row} onSaved={onSaved} />
            </Card>
          )}
          {Array.isArray(row.history) && (
            <Card title="Timeline">
              <Timeline history={row.history} />
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
