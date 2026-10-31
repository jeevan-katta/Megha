'use client';
import { api } from '@/lib/api-client';
import { useEffect, useState, type FormEvent } from 'react';
import type { AdminRow } from './admin-config';
import { Badge, formatDate } from './admin-table';
export function InventoryForm({ row, onSaved }: { row: AdminRow; onSaved: () => void }) {
  const [history, setHistory] = useState<AdminRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [change, setChange] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  useEffect(() => {
    const controller = new AbortController();
    api<AdminRow[]>('/admin/inventory/' + row._id + '/history', undefined, 'GET', controller.signal)
      .then(setHistory)
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [row._id]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await api('/admin/inventory/' + row._id + '/adjust', {
        quantity: Number(fields.get('quantity')),
        reason: fields.get('reason'),
        type: fields.get('type'),
        idempotencyKey: key,
      });
      onSaved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const onHand = Number(row.stock ?? 0);
  const reserved = Number(row.reserved ?? 0);
  const delta = Number(change) || 0;
  return (
    <>
      <section className="adm-card">
        <header>
          <h2>Adjust stock</h2>
        </header>
        <form className="adm-card-body adm-form" onSubmit={submit}>
          <div className="adm-stock-preview">
            <div>
              <span>On hand</span>
              <strong>{onHand}</strong>
            </div>
            <div>
              <span>Reserved</span>
              <strong>{reserved}</strong>
            </div>
            <div>
              <span>Available now</span>
              <strong>{onHand - reserved}</strong>
            </div>
            <div className={delta ? 'changed' : ''}>
              <span>Available after</span>
              <strong>{onHand + delta - reserved}</strong>
            </div>
          </div>
          <div className="adm-form-grid">
            <label>
              Adjustment type
              <select name="type" defaultValue="GOODS_RECEIVED">
                <option value="GOODS_RECEIVED">Goods received</option>
                <option value="DAMAGED">Damaged / write-off</option>
                <option value="MANUAL_ADJUSTMENT">Count correction</option>
              </select>
            </label>
            <label>
              Quantity change
              <input
                name="quantity"
                type="number"
                step="1"
                required
                min="-100000"
                max="100000"
                placeholder="e.g. 10 or -2"
                value={change}
                onChange={(event) => setChange(event.target.value)}
              />
              <small>Positive adds stock, negative removes it.</small>
            </label>
            <label>
              Reason
              <textarea
                name="reason"
                required
                minLength={5}
                maxLength={500}
                rows={2}
                placeholder="Goods received, damaged, count correction…"
              />
            </label>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="adm-btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Record Adjustment'}
          </button>
        </form>
      </section>
      <section className="adm-card">
        <header>
          <h2>Stock history</h2>
        </header>
        {history.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table compact">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="right">Change</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={String(item._id)}>
                    <td data-label="Date">{formatDate(item.createdAt, true)}</td>
                    <td data-label="Type">
                      <Badge status={String(item.type)} />
                    </td>
                    <td data-label="Change" className="right">
                      {Number(item.quantity) > 0 ? '+' : ''}
                      {String(item.quantity)}
                    </td>
                    <td data-label="Reason">{String(item.reason ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="adm-card-body adm-muted">No stock movements recorded yet.</p>
        )}
      </section>
    </>
  );
}
