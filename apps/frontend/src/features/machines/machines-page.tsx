'use client';

import { PageTitle } from '@/components/layout/page-title';
import { ButtonLink } from '@/components/ui/button-link';
import { Img } from '@/components/ui/image';
import { MachineGrid } from '@/features/machines/machine-grid';
import { useStore } from '@/providers/store-provider';
import { ArrowRight } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function Machines() {
  const { catalogue } = useStore();
  const path = usePathname();
  const m = catalogue.machines.find((m) => path.endsWith('/' + m.slug));
  return (
    <div className="container page">
      <PageTitle
        title={m ? m.name : 'Our Laundry Machines'}
        subtitle="Explore our industrial laundry equipment. Machines are available by quotation."
      />
      {m ? (
        <div className="detail-layout">
          <div className="detail-image">
            <Img src={m.image} alt={m.name} />
          </div>
          <div>
            <h2>{m.name}</h2>
            <p>{m.description}</p>
            <div className="spec-row">
              <span>Capacity range</span>
              <strong>{m.capacity}</strong>
            </div>
            <p className="muted">
              Final model, utilities and dimensions will be confirmed in your quotation.
            </p>
            <ButtonLink href={'/bulk-quote?item=' + encodeURIComponent(m.name)}>
              Send Enquiry <ArrowRight size={17} />
            </ButtonLink>
          </div>
        </div>
      ) : (
        <MachineGrid />
      )}
    </div>
  );
}
