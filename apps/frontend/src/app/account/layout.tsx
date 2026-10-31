import { SiteShell } from '@/components/layout/site-shell';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
export const metadata: Metadata = { title: 'My Account', robots: { index: false, follow: false } };
export default function Layout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
