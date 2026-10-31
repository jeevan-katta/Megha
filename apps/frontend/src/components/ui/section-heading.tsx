'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function Heading({
  title,
  subtitle,
  href,
  label = 'View All',
}: {
  title: string;
  subtitle?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {href && (
        <Link href={href}>
          {label} <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
