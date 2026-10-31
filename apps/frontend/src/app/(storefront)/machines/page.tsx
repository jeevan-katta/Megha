import type { Metadata } from 'next';
import { CatalogueBoundary } from '@/components/layout/catalogue-boundary';
import { Machines } from '@/features/machines/machines-page';
export const metadata: Metadata = {
  title: 'Industrial Laundry Machines',
  description:
    'Washer extractors, hydro extractors, tumble dryers and more, supplied by quotation.',
};
export default function Page() {
  return (
    <CatalogueBoundary>
      <Machines />
    </CatalogueBoundary>
  );
}
