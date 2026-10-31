'use client';

import { ButtonLink } from '@/components/ui/button-link';
import { Img } from '@/components/ui/image';
import { useStore } from '@/providers/store-provider';

export function MachineGrid() {
  const { catalogue } = useStore();
  return (
    <div className="machine-grid">
      {catalogue.machines.map((m) => (
        <article className="machine-card" key={m._id}>
          <Img src={m.image} alt={m.name} />
          <h3>{m.name}</h3>
          <p>Capacity: {m.capacity}</p>
          <ButtonLink href={'/machines/' + m.slug} secondary>
            View Details
          </ButtonLink>
        </article>
      ))}
    </div>
  );
}
