import type { Metadata } from 'next';
import { CatalogueBoundary } from '@/components/layout/catalogue-boundary';
import { CataloguePage } from '@/features/catalogue/catalogue-page';
export const metadata: Metadata = {
  title: 'Laundry Spare Parts',
  description:
    'Genuine spare parts for industrial washing machines, hydro extractors, dryers, irons and boilers.',
};
export default function Page() {
  return (
    <CatalogueBoundary>
      <CataloguePage />
    </CatalogueBoundary>
  );
}
