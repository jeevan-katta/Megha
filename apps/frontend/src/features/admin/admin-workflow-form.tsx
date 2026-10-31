'use client';
import { api } from '@/lib/api-client';
import { useStore } from '@/providers/store-provider';
import { transitions } from '@megha/constants';
import { useState, type FormEvent } from 'react';
import type { AdminModule, AdminRow } from './admin-config';
import { useAdminLookups } from './use-admin-lookups';
import { QuoteLinesEditor, type QuoteLine } from './quote-lines-editor';
import { statusLabel } from './admin-table';
export function WorkflowForm({
  module,
  row,
  onSaved,
}: {
  module: AdminModule;
  row: AdminRow;
  onSaved: () => void;
}) {
  const { user } = useStore();
  const data = (row.data ?? {}) as AdminRow;
  const { lookups, lookupError } = useAdminLookups(
    ['service-requests', 'find-my-spare'].includes(module),
  );
  const [lines, setLines] = useState<QuoteLine[]>(
    Array.isArray(data.quoteLines) ? (data.quoteLines as QuoteLine[]) : [],
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nextStates = transitions[module]?.[String(row.status)] ?? [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    const details: AdminRow = {
      internalNotes: fields.get('internalNotes') ?? '',
      publicResponse: fields.get('publicResponse') ?? '',
    };
    for (const field of ['technicianId', 'priority', 'identifiedProductId'])
      if (fields.get(field)) details[field] = fields.get(field);
    for (const field of ['scheduledAt', 'validUntil'])
      if (fields.get(field)) details[field] = new Date(String(fields.get(field))).toISOString();
    if (module === 'enquiries') details.quoteLines = lines;
    const payload =
      module === 'orders'
        ? { status: fields.get('status') }
        : { status: fields.get('status'), data: details };
    try {
      await api('/admin/' + module + '/' + row._id, payload, 'PATCH');
      onSaved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="adm-form" onSubmit={submit}>
      {lookupError && (
        <p className="error" role="alert">
          {lookupError}
        </p>
      )}
      <div className="adm-form-grid">
        <label>
          Status
          <select
            name="status"
            required
            defaultValue={module === 'orders' ? '' : String(row.status)}
          >
            {module === 'orders' ? (
              <option value="" disabled>
                Select next status
              </option>
            ) : (
              <option value={String(row.status)}>{statusLabel(String(row.status))}</option>
            )}
            {nextStates.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        {module !== 'orders' && (
          <>
            <label>
              Priority
              <select name="priority" defaultValue={String(data.priority ?? 'NORMAL')}>
                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Customer response
              <textarea
                name="publicResponse"
                defaultValue={String(data.publicResponse ?? '')}
                maxLength={5000}
              />
            </label>
            <label>
              Internal notes (staff only)
              <textarea
                name="internalNotes"
                defaultValue={String(data.internalNotes ?? '')}
                maxLength={10000}
              />
            </label>
          </>
        )}
        {module === 'service-requests' && (
          <>
            {user?.role !== 'TECHNICIAN' && (
              <label>
                Assigned technician
                <select
                  name="technicianId"
                  key={lookups.technicians?.length}
                  defaultValue={String(data.technicianId ?? '')}
                >
                  <option value="">Unassigned</option>
                  {lookups.technicians?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Visit date and time
              <input name="scheduledAt" type="datetime-local" />
            </label>
          </>
        )}
        {module === 'find-my-spare' && (
          <label>
            Identified part
            <select
              name="identifiedProductId"
              key={lookups.products?.length}
              defaultValue={String(data.identifiedProductId ?? '')}
            >
              <option value="">Select part</option>
              {lookups.products?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {module === 'enquiries' && (
          <label>
            Quotation valid until
            <input name="validUntil" type="datetime-local" />
          </label>
        )}
      </div>
      {module === 'enquiries' && <QuoteLinesEditor lines={lines} setLines={setLines} />}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        className="adm-btn primary"
        disabled={busy || (module === 'orders' && !nextStates.length)}
      >
        {busy ? 'Saving…' : module === 'orders' ? 'Update Status' : 'Save Changes'}
      </button>
    </form>
  );
}
