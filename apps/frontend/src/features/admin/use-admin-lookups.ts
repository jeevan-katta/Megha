'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useStore } from '@/providers/store-provider';
import type { Lookups } from './admin-record-form';
const empty: Lookups = {};
export function useAdminLookups(enabled: boolean) {
  const { user } = useStore();
  const result = useQuery({
    queryKey: ['private', user?._id, 'admin', 'lookups'],
    enabled: enabled && !!user,
    staleTime: 120_000,
    queryFn: ({ signal }) => api<Lookups>('/admin/lookups', undefined, 'GET', signal),
  });
  return { lookups: result.data ?? empty, lookupError: result.error?.message ?? '' };
}
