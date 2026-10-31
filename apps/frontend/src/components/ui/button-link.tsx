'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';

export function ButtonLink({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link className={'button ' + (secondary ? 'secondary' : '')} href={href}>
      {children}
    </Link>
  );
}
