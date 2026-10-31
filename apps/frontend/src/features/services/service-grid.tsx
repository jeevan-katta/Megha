'use client';

import { Img } from '@/components/ui/image';
import { useStore } from '@/providers/store-provider';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function ServiceGrid() {
  const { catalogue } = useStore();
  return (
    <div className="service-grid">
      {catalogue.services.map((s) => (
        <Link href={'/services/' + s.slug} className="service-card" key={s.slug}>
          <Img src={s.image} alt={s.name} />
          <div>
            <h3>{s.name}</h3>
            <p>{s.description}</p>
            <span className="circle-arrow">
              <ArrowRight size={17} />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
