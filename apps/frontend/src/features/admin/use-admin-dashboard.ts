'use client';
import { api } from '@/lib/api-client';
import type { AdminDashboardData, DashboardRange } from '@megha/types';

export const defaultDashboardRange: DashboardRange = '30d';
/** Shared by the dashboard and sidebar prefetching, so a prefetch fills the entry the page reads. */
export function adminDashboardQuery(
  userId: string | undefined,
  range: DashboardRange = defaultDashboardRange,
) {
  return {
    // Under 'reports' so writes that change sales, stock or requests refresh it.
    queryKey: ['private', userId, 'admin', 'reports', range],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api<AdminDashboardData>('/admin/reports?range=' + range, undefined, 'GET', signal),
  };
}
