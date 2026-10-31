'use client';

import { ButtonLink } from '@/components/ui/button-link';
import { Package } from 'lucide-react';

export function Empty({
  title,
  text,
  href,
  label,
}: {
  title: string;
  text?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <Package size={42} />
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {href && <ButtonLink href={href}>{label || 'Continue'}</ButtonLink>}
    </div>
  );
}
