'use client';
import { Empty } from '@/components/ui/empty-state';
import { api } from '@/lib/api-client';
import { useStore } from '@/providers/store-provider';
import type { RecordData, User } from '@megha/types';
import { useQuery } from '@tanstack/react-query';
import { accountQuery } from './use-account-data';
import { Building2, MapPin, Trash2, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { gstinInput, phoneInput } from '@/lib/input-patterns';

const sections = [
  ['details', 'Profile & Company', UserRound],
  ['addresses', 'Addresses', MapPin],
] as const;

/** One place for the customer's details, company and saved addresses. */
export function ProfileOverview({ user }: { user: User }) {
  return (
    <div className="profile-overview">
      <nav className="profile-sections" aria-label="Profile sections">
        {sections.map(([id, label, Icon]) => (
          <a key={id} href={'#' + id}>
            <Icon size={15} />
            {label}
          </a>
        ))}
      </nav>
      <ProfileForm user={user} />
      <AddressBook userId={user._id} />
    </div>
  );
}

function ProfileForm({ user }: { user: User }) {
  const { setUser, notice } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      setUser(await api<User>('/me', Object.fromEntries(fields), 'PATCH'));
      notice('Profile saved.');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel profile-section" id="details" onSubmit={submit}>
      <h2>
        <UserRound size={20} /> Personal details
      </h2>
      <div className="form-grid">
        <label>
          Full name
          <input name="name" defaultValue={user.name} required minLength={2} maxLength={100} />
        </label>
        <label>
          Phone
          <input name="phone" defaultValue={user.phone || ''} {...phoneInput} />
        </label>
        <label>
          Email address
          <input value={user.email} disabled readOnly />
        </label>
      </div>
      <h2>
        <Building2 size={20} /> Company details
      </h2>
      <div className="form-grid">
        <label>
          Company
          <input name="company" defaultValue={user.company || ''} maxLength={150} />
        </label>
        <label>
          GSTIN
          <input name="gstin" defaultValue={user.gstin || ''} {...gstinInput} />
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
    </form>
  );
}

function AddressBook({ userId }: { userId: string }) {
  const { notice } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const addresses = useQuery({
    ...accountQuery('records/addresses', userId),
    select: (data) => data as RecordData[],
  });
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await api('/me/records/addresses', {
        title: fields.get('title'),
        description: fields.get('description'),
        data: {},
      });
      form.reset();
      notice('Address saved.');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await api('/me/records/' + id, undefined, 'DELETE');
      notice('Address removed.');
    } catch (error) {
      notice((error as Error).message);
    }
  }
  const list = addresses.data ?? [];
  return (
    <section className="panel profile-section" id="addresses">
      <h2>
        <MapPin size={20} /> My Addresses
      </h2>
      {addresses.isLoading ? (
        <p role="status">Loading addresses…</p>
      ) : addresses.error ? (
        <p className="error" role="alert">
          {addresses.error.message}
        </p>
      ) : list.length ? (
        <div className="address-list">
          {list.map((address) => (
            <div className="address-card" key={address._id}>
              <MapPin size={18} />
              <div>
                <strong>{address.title}</strong>
                <p>{address.description}</p>
              </div>
              <button
                className="remove"
                aria-label={'Remove ' + address.title}
                onClick={() => remove(address._id)}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No saved addresses" text="Add an address for faster checkout." />
      )}
      <form className="address-form" onSubmit={save}>
        <h3>Add a new address</h3>
        <label>
          Address name
          <input name="title" required minLength={2} maxLength={200} placeholder="Office" />
        </label>
        <label>
          Full address
          <textarea name="description" required maxLength={1000} rows={3} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy}>{busy ? 'Saving…' : 'Save Address'}</button>
      </form>
    </section>
  );
}
