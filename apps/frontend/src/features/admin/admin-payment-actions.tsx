'use client';
import { api } from '@/lib/api-client';
import { useState } from 'react';
import type { AdminRow } from './admin-config';
export function AdminPaymentActions({ row, onSaved }: { row: AdminRow; onSaved: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (row.paymentProvider !== 'razorpay' || !row.providerOrderId)
    return <p className="adm-muted">No Razorpay transaction has been started for this order.</p>;
  async function reconcile() {
    setBusy(true);
    setError('');
    try {
      await api('/admin/payments/' + row._id + '/reconcile', {});
      onSaved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="adm-form">
      <p className="adm-muted">
        Fetch the latest captured payment from Razorpay and update this order.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="adm-btn primary" disabled={busy} onClick={reconcile}>
        {busy ? 'Checking…' : 'Reconcile with Razorpay'}
      </button>
    </div>
  );
}
