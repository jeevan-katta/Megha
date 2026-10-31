import type { Metadata } from 'next';
import { CatalogueBoundary } from '@/components/layout/catalogue-boundary';
import { CataloguePage } from '@/features/catalogue/catalogue-page';
export const metadata: Metadata = { title: 'Search', robots: { index: false, follow: true } };
export default function Page() {
  return (
    <CatalogueBoundary>
      <CataloguePage />
    </CatalogueBoundary>
  );
}
