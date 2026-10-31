'use client';

import { api } from '@/lib/api-client';
import { useStore } from '@/providers/store-provider';
import { Mail } from 'lucide-react';
import { emailInput } from '@/lib/input-patterns';

export function Newsletter() {
  const { notice } = useStore();
  return (
    <div className="newsletter">
      <form
        className="container"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          try {
            await api('/newsletter', { email: new FormData(form).get('email') });
            notice('Your newsletter preference has been saved.');
            form.reset();
          } catch (e) {
            notice((e as Error).message);
          }
        }}
      >
        <Mail size={40} />
        <div>
          <h3>Subscribe to Our Newsletter</h3>
          <p>Get updates on products, services and industry tips.</p>
        </div>
        <div className="subscribe-input">
          <input
            aria-label="Newsletter email"
            name="email"
            required
            {...emailInput}
            placeholder="Enter your email address"
          />
          <button>Subscribe</button>
        </div>
      </form>
    </div>
  );
}
