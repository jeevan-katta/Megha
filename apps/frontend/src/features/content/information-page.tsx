'use client';

import { PageTitle } from '@/components/layout/page-title';
import { ButtonLink } from '@/components/ui/button-link';
import { api } from '@/lib/api-client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function Information() {
  const path = usePathname();
  const [published, setPublished] = useState<{ title: string; description: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const section = path.startsWith('/policies/')
      ? 'policy'
      : path.startsWith('/resources/')
        ? 'resource'
        : 'faq';
    const slug = path.split('/')[2] || path.slice(1);
    setPublished(null);
    api<{ title: string; description: string } | null>(
      '/content/' + section + '/' + slug,
      undefined,
      'GET',
      controller.signal,
    )
      .then(setPublished)
      .catch(() => {});
    return () => controller.abort();
  }, [path]);
  const policy = path.startsWith('/policies/');
  const title = policy
    ? path.split('/')[2] + ' Policy'
    : path === '/about'
      ? 'About Megha Laundry Equipment'
      : path === '/faq'
        ? 'Frequently Asked Questions'
        : 'Laundry Resources';
  return (
    <div className="container page">
      <PageTitle title={published?.title ?? title} />
      <div className="panel prose">
        {published ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{published.description}</p>
        ) : policy ? (
          <>
            <h2>Policy content pending approval</h2>
            <p>
              The approved {path.split('/')[2]} policy has not been supplied. This local application
              is not accepting live purchases.
            </p>
            <ButtonLink href="/contact">Contact Megha</ButtonLink>
          </>
        ) : path === '/about' ? (
          <>
            <h2>Your partner in industrial laundry</h2>
            <p>
              Megha Laundry Equipment supplies industrial laundry machines and spare parts, with
              installation, repair and maintenance services.
            </p>
            <p>
              Explore the supplied catalogue, ask about a machine, or share your spare-part
              requirement with the technical team.
            </p>
            <ButtonLink href="/machines">Explore Machines</ButtonLink>
          </>
        ) : (
          <>
            <h2>How do I identify the correct spare?</h2>
            <p>
              Check the machine model and visible part number. Our technical team can review your
              description through Find My Spare. Confirm specifications and compatibility before
              ordering.
            </p>
            <h2>Can I purchase a machine online?</h2>
            <p>
              Machines are supplied by quotation. Select a machine and send an enquiry to discuss
              your requirements.
            </p>
            <h2>How do I request a repair?</h2>
            <p>Open Services and submit your machine, location and issue details.</p>
            <ButtonLink href="/find-my-spare">Ask Our Team</ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}
