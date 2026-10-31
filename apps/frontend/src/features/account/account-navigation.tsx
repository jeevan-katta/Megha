import { api } from '@/lib/api-client';
import { useStore } from '@/providers/store-provider';
import type { RecordData, User } from '@megha/types';
import {
  Bell,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  ScanSearch,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  Wrench,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect } from 'react';
import { adminDashboardQuery } from '@/features/admin/use-admin-dashboard';
import { accountQuery, accountResource } from './use-account-data';
export const accountTabs = [
  ['Dashboard', 'dashboard', LayoutDashboard],
  ['My Profile', 'profile', UserRound],
  ['My Orders', 'orders', ShoppingBag],
  ['My Enquiries', 'enquiries', MessageSquareText],
  ['My Service Requests', 'service-requests', Wrench],
  ['Find My Spare', 'find-my-spare', ScanSearch],
  ['Saved Items', 'saved', Heart],
  ['Notifications', 'notifications', Bell],
] as const;
export function AccountNavigation({ user, tab }: { user: User; tab: string }) {
  const { setUser, notice } = useStore();
  const client = useQueryClient();
  const prefetch = useCallback(
    (tab: string) => void client.prefetchQuery(accountQuery(accountResource(tab), user._id)),
    [client, user._id],
  );
  // Warm the tabs customers open most, once the browser is idle.
  useEffect(() => {
    const warm = () => ['orders', 'enquiries'].forEach(prefetch);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 500);
    return () => window.clearTimeout(id);
  }, [prefetch]);
  const notifications = useQuery({ ...accountQuery('records/notifications', user._id) });
  const unread = ((notifications.data as RecordData[] | undefined) ?? []).filter(
    (record) => record.status === 'UNREAD',
  ).length;
  async function logout() {
    try {
      await api('/auth/logout', {});
      setUser(null);
    } catch (error) {
      notice((error as Error).message);
    }
  }
  return (
    <aside className="panel account-nav">
      <div className="profile-mini">
        <div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div>
        <div>
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </div>
      </div>
      {accountTabs.map(([label, id, Icon]) => (
        <Link
          key={id}
          href={'/account' + (id === 'dashboard' ? '' : '/' + id)}
          className={tab === id ? 'active' : ''}
          aria-current={tab === id ? 'page' : undefined}
          onPointerEnter={() => prefetch(id)}
          onPointerDown={() => prefetch(id)}
          onFocus={() => prefetch(id)}
        >
          <Icon size={17} />
          {label}
          {id === 'notifications' && unread > 0 && (
            <span className="nav-count" aria-label={unread + ' unread'}>
              {unread}
            </span>
          )}
        </Link>
      ))}
      {user.role !== 'CUSTOMER' && (
        <Link
          href="/admin"
          onPointerEnter={() => void client.prefetchQuery(adminDashboardQuery(user._id))}
          onFocus={() => void client.prefetchQuery(adminDashboardQuery(user._id))}
        >
          <ShieldCheck size={17} />
          Staff Administration
        </Link>
      )}
      <button className="text-button" onClick={logout}>
        <LogOut size={17} />
        Logout
      </button>
    </aside>
  );
}
