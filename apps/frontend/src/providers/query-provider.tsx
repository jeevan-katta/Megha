'use client';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { createQueryClient, onMutation } from '@/lib/query-cache';
import { affectedByMutation } from '@/lib/query-invalidation';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  useEffect(
    () =>
      onMutation((path) => {
        if (path.startsWith('/auth/')) {
          client.removeQueries({ queryKey: ['private'] });
          return;
        }
        void client.invalidateQueries({
          predicate: (query) => affectedByMutation(path, query.queryKey),
        });
      }),
    [client],
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
