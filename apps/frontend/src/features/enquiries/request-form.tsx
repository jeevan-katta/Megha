'use client';

import { Empty } from '@/components/ui/empty-state';
import { api } from '@/lib/api-client';
import { useStore } from '@/providers/store-provider';
import { type RecordData } from '@megha/types';
import { ArrowRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { emailInput, phoneInput } from '@/lib/input-patterns';

export function RequestForm({
  kind,
  title,
  item = '',
}: {
  kind: string;
  title: string;
  item?: string;
}) {
  const { user } = useStore();
  const [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      const r = await api<RecordData>('/requests/' + kind, {
        title: String(f.get('subject') || title),
        name: f.get('name'),
        email: f.get('email'),
        phone: f.get('phone'),
        description: f.get('description'),
        data: {
          company: f.get('company'),
          machine: f.get('machine'),
          partNumber: f.get('partNumber') || undefined,
          quantity: Number(f.get('quantity') || 1),
          location: f.get('location'),
        },
      });
      setSuccess(r.number || r._id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (success)
    return (
      <Empty
        title="Your request has been received"
        text={
          'Reference: ' +
          success +
          '. ' +
          (user
            ? 'You can follow it in your account.'
            : 'Please keep this reference for future enquiries.')
        }
        href={user ? '/account' : '/'}
        label={user ? 'My Account' : 'Back to Home'}
      />
    );
  return (
    <form className="panel request-form" onSubmit={submit}>
      <h2>{title}</h2>
      <p className="muted">Fields marked * are required.</p>
      <div className="form-grid">
        <label>
          Full name *<input name="name" required minLength={2} defaultValue={user?.name} />
        </label>
        <label>
          Company
          <input name="company" />
        </label>
        <label>
          Email address *<input name="email" required {...emailInput} defaultValue={user?.email} />
        </label>
        <label>
          Phone number *<input name="phone" required {...phoneInput} />
        </label>
        <label>
          Machine / model
          <input name="machine" placeholder="If known" />
        </label>
        <label>
          Location
          <input name="location" placeholder="City and PIN code" />
        </label>
        {kind === 'find-my-spare' && (
          <label>
            Part number
            <input name="partNumber" placeholder="If visible" />
          </label>
        )}
        {(kind === 'find-my-spare' || kind === 'enquiries') && (
          <>
            <label>
              Quantity
              <input name="quantity" type="number" min="1" defaultValue="1" />
            </label>
          </>
        )}
      </div>
      <label>
        Subject
        <input name="subject" defaultValue={item ? 'Enquiry: ' + item : title} />
      </label>
      <label>
        Describe your requirement *<textarea name="description" required minLength={5} rows={5} />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button disabled={busy}>
        {busy ? 'Submitting…' : 'Submit Request'}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
