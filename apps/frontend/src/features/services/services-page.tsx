'use client';

import { PageTitle } from '@/components/layout/page-title';
import { RequestForm } from '@/features/enquiries/request-form';
import { ServiceGrid } from '@/features/services/service-grid';
import { useStore } from '@/providers/store-provider';
import { usePathname } from 'next/navigation';

export function Services() {
  const { catalogue } = useStore();
  const path = usePathname();
  const s = catalogue.services.find((s) => path.endsWith('/' + s.slug));
  return (
    <div className="container page">
      <PageTitle
        title={s ? s.name : 'Our Services'}
        subtitle="Technical support for your laundry equipment throughout its lifecycle."
      />
      {s ? (
        <RequestForm kind="service-requests" title={s.name} />
      ) : (
        <>
          <ServiceGrid />
          <div className="section">
            <RequestForm kind="service-requests" title="Request a Service" />
          </div>
        </>
      )}
    </div>
  );
}
