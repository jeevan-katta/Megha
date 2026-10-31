'use client';
import { useStore } from '@/providers/store-provider';
import { Check, Factory, LayoutGrid, UserRound, Wrench, X } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Footer } from './footer';
import { Header } from './header';
export function SiteShell({ children }: { children: ReactNode }) {
  const { toast, dismissNotice, runtime } = useStore();
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      {runtime.development && (
        <div className="dev-label">
          Local development · Reference prices & sample inventory · No live charges
        </div>
      )}
      <nav className="mobile-bottom" aria-label="Mobile navigation">
        <Link href="/">
          <Factory />
          Home
        </Link>
        <Link href="/spare-parts">
          <LayoutGrid />
          Categories
        </Link>
        <Link href="/services">
          <Wrench />
          Services
        </Link>
        <Link href="/account">
          <UserRound />
          Account
        </Link>
      </nav>
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          {toast}
          <button onClick={dismissNotice} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
