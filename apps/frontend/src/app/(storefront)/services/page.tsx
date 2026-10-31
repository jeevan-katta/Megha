import type { Metadata } from 'next';
import { CatalogueBoundary } from '@/components/layout/catalogue-boundary';
import { Services } from '@/features/services/services-page';
export const metadata: Metadata = {
  title: 'Laundry Machine Services',
  description: 'Installation, repair, AMC and CMC services for industrial laundry machines.',
};
export default function Page() {
  return (
    <CatalogueBoundary>
      <Services />
    </CatalogueBoundary>
  );
}
