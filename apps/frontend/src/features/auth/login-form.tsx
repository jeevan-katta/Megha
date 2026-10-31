'use client';

import { api } from '@/lib/api-client';
import { useStore } from '@/providers/store-provider';
import { type User } from '@megha/types';
import { UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { emailInput } from '@/lib/input-patterns';

export function Login({ returnTo }: { returnTo?: string }) {
  const { setUser } = useStore();
  const router = useRouter();
  const [register, setRegister] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="panel login-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const f = new FormData(e.currentTarget);
        try {
          const u = await api<User>('/auth/' + (register ? 'register' : 'login'), {
            ...(register ? { name: f.get('name') } : {}),
            email: f.get('email'),
            password: f.get('password'),
          });
          setUser(u);
          if (returnTo) router.push(returnTo);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="round-icon">
        <UserRound size={30} />
      </div>
      <h2>{register ? 'Create your account' : 'Welcome to Megha'}</h2>
      <p>Manage your orders, enquiries and service requests.</p>
      {register && (
        <label>
          Full name
          <input name="name" required minLength={2} autoComplete="name" />
        </label>
      )}
      <label>
        Email address
        <input name="email" required {...emailInput} />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete={register ? 'new-password' : 'current-password'}
        />
      </label>
      {register ? (
        <small>Use at least 10 characters.</small>
      ) : (
        <Link href="/reset-password" className="login-forgot">
          Forgot password?
        </Link>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button disabled={busy}>
        {busy ? 'Please wait…' : register ? 'Create Account' : 'Sign In'}
      </button>
      <button
        className="text-button"
        type="button"
        onClick={() => {
          setRegister(!register);
          setError('');
        }}
      >
        {register ? 'Already have an account? Sign in' : 'New to Megha? Create an account'}
      </button>
    </form>
  );
}
