import { SiteShell } from '@/components/layout/site-shell';
import type { ReactNode } from 'react';
// Pages that read the catalogue wrap themselves in CatalogueBoundary, so content pages, forms and
// the home page hero render without waiting for catalogue data.
export default function Layout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
