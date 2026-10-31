import type { ReactNode } from 'react';

export function LoadingState({ children = 'Loading…' }: { children?: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="loading-state">
      {children}
    </p>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const positive = [
    'ACTIVE',
    'PAID',
    'CAPTURED',
    'DELIVERED',
    'COMPLETED',
    'CLOSED',
    'RESOLVED',
  ].includes(status);
  return (
    <span className={'badge' + (positive ? ' green' : '')}>{status.replaceAll('_', ' ')}</span>
  );
}
