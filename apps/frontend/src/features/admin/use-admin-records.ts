'use client';
import { api } from '@/lib/api-client';
import { useStore } from '@/providers/store-provider';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { AdminModule, AdminRow } from './admin-config';
export interface AdminPageData {
  items: AdminRow[];
  total: number;
  page: number;
  pages: number;
}
const emptyRows: AdminRow[] = [];
/** Shared by the list and by sidebar prefetching, so a prefetch fills the exact entry a page reads. */
export function adminRecordsQuery(
  module: AdminModule,
  userId: string | undefined,
  query = '',
  page = 1,
  status = '',
  sort = 'newest',
  view = '',
) {
  return {
    queryKey: ['private', userId, 'admin', module, query, page, status, sort, view],
    queryFn: ({ signal }: { signal: AbortSignal }) => {
      const params = new URLSearchParams({ q: query, page: String(page), status, sort, view });
      return api<AdminPageData>('/admin/' + module + '?' + params, undefined, 'GET', signal);
    },
  };
}
export function useAdminRecords(
  module: AdminModule,
  enabled: boolean,
  query = '',
  page = 1,
  status = '',
  sort = 'newest',
  view = '',
) {
  const { user } = useStore();
  const result = useQuery({
    ...adminRecordsQuery(module, user?._id, query, page, status, sort, view),
    enabled: enabled && !!user,
  });
  const { refetch } = result;
  const reload = useCallback(() => {
    void refetch({ cancelRefetch: false });
  }, [refetch]);
  return {
    rows: result.data?.items ?? emptyRows,
    error: result.error?.message ?? '',
    loading: result.isLoading,
    reload,
    total: result.data?.total ?? 0,
    pages: result.data?.pages ?? 1,
  };
}
