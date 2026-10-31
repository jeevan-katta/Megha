'use client';
import { api } from '@/lib/api-client';
import { useStore } from '@/providers/store-provider';
import { useState, type FormEvent } from 'react';
import { useAdminLookups } from './use-admin-lookups';
import { createLabel, type AdminModule, type AdminRow } from './admin-config';
import { fieldsFor, fieldValue, formPayload, type Field } from './admin-form-config';
import { AdminImageField } from './admin-image-field';
export type Lookups = Record<string, { value: string; label: string }[]>;

function FieldInput({ field, row, lookups }: { field: Field; row?: AdminRow; lookups: Lookups }) {
  const value = fieldValue(row ?? {}, field);
  if (field.name === 'image') return <AdminImageField initialValue={String(value)} />;
  const options = field.lookup
    ? (lookups[field.lookup] ?? [])
    : field.options?.map((value) => ({ value, label: value.replaceAll('_', ' ') }));
  const wide = ['textarea', 'specifications', 'keywords'].includes(field.type ?? '');
  return (
    <label className={(field.type === 'checkbox' ? 'check-label ' : '') + (wide ? 'wide' : '')}>
      {field.label}
      {field.required ? ' *' : ''}
      {field.type === 'checkbox' ? (
        <input name={field.name} type="checkbox" defaultChecked={Boolean(value)} />
      ) : field.type === 'select' ? (
        <select
          key={field.name + options?.length}
          name={field.name}
          required={field.required}
          defaultValue={String(value || options?.[0]?.value || '')}
        >
          {field.lookup && <option value="">Select…</option>}
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : ['textarea', 'specifications'].includes(field.type ?? '') ? (
        <textarea
          name={field.name}
          defaultValue={String(value)}
          required={field.required}
          rows={field.type === 'specifications' ? 8 : 4}
        />
      ) : (
        <input
          name={field.name}
          defaultValue={String(value)}
          required={field.required}
          autoComplete={field.type === 'password' ? 'new-password' : 'off'}
          minLength={field.type === 'password' ? 12 : undefined}
          type={
            ['number', 'money'].includes(field.type ?? '')
              ? 'number'
              : field.type === 'email' || field.type === 'password'
                ? field.type
                : 'text'
          }
          step={field.type === 'money' ? '0.01' : field.type === 'number' ? 'any' : undefined}
        />
      )}
    </label>
  );
}

export function AdminRecordForm({
  module,
  row,
  onSaved,
  onClose,
}: {
  module: AdminModule;
  row?: AdminRow;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { user } = useStore();
  const fields = fieldsFor(module, !row, user?.role ?? '');
  const { lookups, lookupError } = useAdminLookups(fields.some((field) => !!field.lookup));
  const sections = [...new Set(fields.map((field) => field.section ?? 'Details'))];
  const [tab, setTab] = useState(sections[0]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(
        '/admin/' + module + (row ? '/' + row._id : ''),
        formPayload(fields, new FormData(event.currentTarget)),
        row ? 'PATCH' : 'POST',
      );
      onSaved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const noun = (createLabel[module] ?? 'Add record').replace(/^(Add|New) /, '').toLowerCase();
  const heading = row ? String(row.name ?? row.title ?? 'Edit ' + noun) : 'New ' + noun;
  return (
    <form
      className="adm-editor"
      onSubmit={submit}
      // Inactive tabs stay mounted so their values submit; jump to the tab holding an invalid field.
      onInvalidCapture={(event) => {
        const section = (event.target as HTMLElement)
          .closest('[data-section]')
          ?.getAttribute('data-section');
        if (section && section !== tab) setTab(section);
      }}
    >
      <div className="adm-detail-head">
        <div>
          <h1>{heading}</h1>
          <div className="adm-detail-meta">
            <span>{row ? 'Editing ' + noun : 'Create a new ' + noun}</span>
            {typeof row?.sku === 'string' && <span className="adm-mono">{row.sku}</span>}
          </div>
        </div>
      </div>
      {lookupError && (
        <p className="error" role="alert">
          {lookupError}
        </p>
      )}
      <section className="adm-card">
        {sections.length > 1 && (
          <div className="adm-status-tabs adm-form-tabs" role="tablist" aria-label="Form sections">
            {sections.map((section) => (
              <button
                type="button"
                role="tab"
                key={section}
                aria-selected={tab === section}
                onClick={() => setTab(section)}
              >
                {section}
              </button>
            ))}
          </div>
        )}
        {sections.map((section) => (
          <div
            key={section}
            data-section={section}
            className="adm-card-body adm-form-grid"
            hidden={section !== tab}
          >
            {fields
              .filter((field) => (field.section ?? 'Details') === section)
              .map((field) => (
                <FieldInput key={field.name} field={field} row={row} lookups={lookups} />
              ))}
          </div>
        ))}
      </section>
      <div className="adm-savebar">
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : (
          <span className="adm-muted">Fields marked * are required.</span>
        )}
        <div className="adm-head-actions">
          <button type="button" className="adm-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="adm-btn primary" disabled={busy}>
            {busy ? 'Saving…' : row ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </form>
  );
}
