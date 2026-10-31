'use client';
import { api } from '@/lib/api-client';
import type { Order, RecordData } from '@megha/types';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
const emptyOrders: Order[] = [];
const emptyRecords: RecordData[] = [];
/** Read for an account tab. Shared with menu prefetching so both fill the same cache entry. */
export function accountQuery(resource: string, userId?: string) {
  return {
    queryKey: ['private', userId, 'account', resource],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api<Order[] | RecordData[]>('/me/' + resource, undefined, 'GET', signal),
  };
}
/** The resource each tab reads; the profile tab reads its saved addresses. */
export const accountResource = (tab: string) =>
  ['dashboard', 'orders'].includes(tab)
    ? 'orders'
    : tab === 'profile'
      ? 'records/addresses'
      : 'records/' + tab;
export function useAccountData(tab: string, userId?: string) {
  const ordersTab = ['dashboard', 'orders'].includes(tab);
  const resource = ordersTab ? 'orders' : 'records/' + tab;
  const result = useQuery({
    ...accountQuery(resource, userId),
    // The profile tab loads its own addresses.
    enabled: !!userId && tab !== 'profile',
  });
  const { refetch } = result;
  const reload = useCallback(() => {
    void refetch({ cancelRefetch: false });
  }, [refetch]);
  return {
    orders: ordersTab ? ((result.data as Order[] | undefined) ?? emptyOrders) : emptyOrders,
    records: !ordersTab
      ? ((result.data as RecordData[] | undefined) ?? emptyRecords)
      : emptyRecords,
    loading: result.isLoading,
    error: result.error?.message ?? '',
    reload,
  };
}
