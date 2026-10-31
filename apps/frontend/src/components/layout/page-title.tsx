'use client';

import Link from 'next/link';

/** Breadcrumb and page heading. `breadcrumbOnly` is for pages that place their own `h1`. */
export function PageTitle({
  title,
  subtitle,
  breadcrumbOnly = false,
}: {
  title: string;
  subtitle?: string;
  breadcrumbOnly?: boolean;
}) {
  return (
    <div className="page-title">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <span>›</span>
        <span>{title}</span>
      </div>
      {!breadcrumbOnly && <h1>{title}</h1>}
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
