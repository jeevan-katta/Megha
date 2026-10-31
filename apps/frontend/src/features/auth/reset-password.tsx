'use client';

import { PageTitle } from '@/components/layout/page-title';
import { api } from '@/lib/api-client';
import { useStore } from '@/providers/store-provider';
import { KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { emailInput } from '@/lib/input-patterns';

export function ResetPassword() {
  return (
    <div className="container page">
      <PageTitle title="Reset Password" />
      <Suspense fallback={<RequestLink />}>
        <ResetFromLink />
      </Suspense>
    </div>
  );
}

/** The email link opens /reset-password?token=…; without a token the customer asks for one. */
function ResetFromLink() {
  const token = useSearchParams().get('token') ?? '';
  return token ? <ChoosePassword token={token} /> : <RequestLink />;
}

function useSubmit(action: (form: FormData) => Promise<{ message: string }>) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setDone((await action(new FormData(event.currentTarget))).message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, done, submit };
}

function RequestLink() {
  const { busy, error, done, submit } = useSubmit((f) =>
    api<{ message: string }>('/auth/forgot-password', { email: f.get('email') }),
  );
  return (
    <form className="panel login-form" onSubmit={submit}>
      <div className="round-icon">
        <KeyRound size={28} />
      </div>
      <h2>Forgot your password?</h2>
      <p>Enter your account email and we will send you a link to choose a new password.</p>
      {done ? (
        <p className="success-text" role="status">
          {done}
        </p>
      ) : (
        <>
          <label>
            Email address
            <input name="email" required {...emailInput} />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button disabled={busy}>{busy ? 'Sending…' : 'Send Reset Link'}</button>
        </>
      )}
      <Link href="/account" className="login-forgot">
        Back to sign in
      </Link>
    </form>
  );
}

function ChoosePassword({ token }: { token: string }) {
  const { setUser } = useStore();
  const [mismatch, setMismatch] = useState(false);
  const { busy, error, done, submit } = useSubmit(async (f) => {
    const result = await api<{ message: string }>('/auth/reset-password', {
      token,
      password: f.get('password'),
    });
    // Every session was signed out, including this browser's.
    setUser(null);
    return result;
  });
  return (
    <form
      className="panel login-form"
      onSubmit={(event) => {
        const f = new FormData(event.currentTarget);
        if (f.get('password') !== f.get('confirm')) {
          event.preventDefault();
          setMismatch(true);
          return;
        }
        setMismatch(false);
        void submit(event);
      }}
    >
      <div className="round-icon">
        <KeyRound size={28} />
      </div>
      <h2>Choose a new password</h2>
      {done ? (
        <>
          <p className="success-text" role="status">
            {done}
          </p>
          <Link href="/account" className="button">
            Sign In
          </Link>
        </>
      ) : (
        <>
          <label>
            New password
            <input
              name="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm new password
            <input
              name="confirm"
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <small>Use at least 10 characters.</small>
          {(mismatch || error) && (
            <p className="error" role="alert">
              {mismatch ? 'The two passwords do not match.' : error}
            </p>
          )}
          {error.includes('expired') && (
            <Link href="/reset-password" className="login-forgot">
              Request a new link
            </Link>
          )}
          <button disabled={busy}>{busy ? 'Saving…' : 'Save New Password'}</button>
        </>
      )}
    </form>
  );
}
