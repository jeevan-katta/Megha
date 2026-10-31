'use client';
import { useStore } from '@/providers/store-provider';
import type { ReactNode } from 'react';
/** `ready`: the page already has server-rendered data, so it renders without waiting. */
export function CatalogueBoundary({
  children,
  ready = false,
}: {
  children: ReactNode;
  ready?: boolean;
}) {
  const { catalogueLoading, catalogueError, reloadCatalogue } = useStore();
  if (ready) return children;
  if (catalogueLoading)
    return (
      <div className="container catalogue-skeleton" role="status" aria-label="Loading catalogue">
        <span className="skeleton-line" />
        <div className="skeleton-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <span className="skeleton-card" key={index} />
          ))}
        </div>
      </div>
    );
  if (catalogueError)
    return (
      <div className="container page">
        <p className="error" role="alert">
          {catalogueError}
        </p>
        <button onClick={reloadCatalogue}>Retry</button>
      </div>
    );
  return children;
}
