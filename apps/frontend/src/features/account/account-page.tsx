'use client';
import { PageTitle } from '@/components/layout/page-title';
import { Login } from '@/features/auth/login-form';
import { OrderList } from '@/features/orders/order-list';
import { useStore } from '@/providers/store-provider';
import { usePathname } from 'next/navigation';
import { AccountDashboard } from './account-dashboard';
import { AccountNavigation } from './account-navigation';
import { AccountRecords } from './account-records';
import { ProfileOverview } from './profile-form';
import { useAccountData } from './use-account-data';

export function Account() {
  const path = usePathname();
  return <AccountTab key={path} tab={path.split('/')[2] || 'dashboard'} />;
}
function AccountTab({ tab }: { tab: string }) {
  const { user, authLoading } = useStore();
  const { orders, records, loading, error, reload } = useAccountData(tab, user?._id);
  if (authLoading)
    return (
      <div className="container page" role="status">
        Loading your account…
      </div>
    );
  if (!user)
    return (
      <div className="container page">
        <PageTitle title="My Account" />
        <Login />
      </div>
    );
  return (
    <div className="container page">
      <PageTitle title="My Account" subtitle="Manage your profile, orders, enquiries and more." />
      <div className="account-layout">
        <AccountNavigation tab={tab} user={user} />
        <div>
          {error && (
            <p className="error" role="alert">
              {error}{' '}
              <button className="text-button" onClick={reload}>
                Retry
              </button>
            </p>
          )}
          {loading ? (
            <p role="status">Loading…</p>
          ) : error ? null : tab === 'dashboard' ? (
            <AccountDashboard orders={orders} />
          ) : tab === 'profile' ? (
            <ProfileOverview user={user} />
          ) : tab === 'orders' ? (
            <div className="panel">
              <h2>My Orders</h2>
              <OrderList orders={orders} showFilters />
            </div>
          ) : (
            <AccountRecords tab={tab} records={records} onChange={reload} />
          )}
        </div>
      </div>
    </div>
  );
}
