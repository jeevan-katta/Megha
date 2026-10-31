import '@/styles/admin.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
export const metadata: Metadata = {
  title: 'Staff Administration',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: ReactNode }) {
  return <main id="main">{children}</main>;
}
