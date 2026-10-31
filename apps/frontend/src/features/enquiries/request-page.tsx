'use client';

import { PageTitle } from '@/components/layout/page-title';
import { RequestForm } from '@/features/enquiries/request-form';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export function RequestPage() {
  const path = usePathname();
  // Quotation requests and general contact both land in the customer's enquiries.
  const kind = path === '/find-my-spare' ? 'find-my-spare' : 'enquiries';
  const title =
    kind === 'find-my-spare'
      ? 'Find My Spare'
      : path === '/bulk-quote'
        ? 'Send an Enquiry'
        : 'Contact Megha';
  return (
    <div className="container page">
      <PageTitle
        title={title}
        subtitle="Share your requirements and our team can review your request."
      />
      <Suspense fallback={<RequestForm kind={kind} title={title} />}>
        <RequestFormForItem kind={kind} title={title} />
      </Suspense>
    </div>
  );
}

/** "Send Enquiry" on a product or machine links here with ?item=<name>; keep it on the request. */
function RequestFormForItem({ kind, title }: { kind: string; title: string }) {
  const item = useSearchParams().get('item')?.trim().slice(0, 150) ?? '';
  return <RequestForm key={item} kind={kind} title={title} item={item} />;
}
