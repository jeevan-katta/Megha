import { permitted } from '@megha/constants';
import type { User } from '@megha/types';
import {
  BarChart3,
  Boxes,
  CreditCard,
  Factory,
  FileText,
  FolderTree,
  HardHat,
  History,
  LayoutDashboard,
  Link2,
  MessageSquareText,
  Package,
  ScanSearch,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Users,
  Warehouse,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect } from 'react';
import { moduleLabel, navGroups, navOwner, type AdminModule } from './admin-config';
import { adminDashboardQuery } from './use-admin-dashboard';
import { adminRecordsQuery } from './use-admin-records';

/** Busiest screens, warmed in the background so their first visit shows data immediately. */
const warmModules: AdminModule[] = ['reports', 'orders', 'products', 'inventory', 'shipments'];

export const moduleIcons: Record<AdminModule, LucideIcon> = {
  reports: LayoutDashboard,
  products: Package,
  categories: FolderTree,
  machines: Factory,
  'machine-models': Boxes,
  compatibility: Link2,
  inventory: Warehouse,
  orders: ShoppingBag,
  payments: CreditCard,
  shipments: Truck,
  customers: Users,
  enquiries: MessageSquareText,
  'service-requests': Wrench,
  technicians: HardHat,
  'find-my-spare': ScanSearch,
  content: FileText,
  users: ShieldCheck,
  audit: History,
  settings: Settings,
};

export function AdminNavigation({
  module,
  user,
  open,
  onClose,
}: {
  module: AdminModule;
  user: User;
  open: boolean;
  onClose: () => void;
}) {
  const current = navOwner(module);
  const client = useQueryClient();
  // Prefetches only fill the read cache; fresh entries are reused, so repeated calls are cheap.
  const prefetch = useCallback(
    (target: AdminModule) =>
      void (target === 'reports'
        ? client.prefetchQuery(adminDashboardQuery(user._id))
        : client.prefetchQuery(adminRecordsQuery(target, user._id))),
    [client, user._id],
  );
  useEffect(() => {
    const warm = () =>
      warmModules.filter((target) => permitted(user.role, target)).forEach(prefetch);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 500);
    return () => window.clearTimeout(id);
  }, [prefetch, user.role]);
  return (
    <>
      <div className={'adm-scrim' + (open ? ' open' : '')} onClick={onClose} aria-hidden="true" />
      <aside className={'adm-sidebar' + (open ? ' open' : '')} aria-label="Admin navigation">
        <div className="adm-brand">
          <Link href="/admin" onClick={onClose}>
            {/* Plain img keeps the small logo crisp without Next image sizing rules. */}
            <img src="/assets/logo-mark.webp" alt="Megha" width={92} height={37} />
            <span>Admin</span>
          </Link>
          <button className="adm-icon-button adm-close" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <nav className="adm-nav">
          {navGroups.map((group, index) => {
            const items = group.items
              .map((item) => ({
                ...item,
                target: (item.tabs ?? [item.module]).find((tab) => permitted(user.role, tab)),
              }))
              .filter((item) => item.target);
            if (!items.length) return null;
            return (
              <div className="adm-nav-group" key={group.title ?? index}>
                {group.title && <p>{group.title}</p>}
                {items.map((item) => {
                  const Icon = item.module === 'reports' ? BarChart3 : moduleIcons[item.module];
                  const active = current === item.module;
                  return (
                    <Link
                      key={item.module}
                      href={'/admin/' + item.target}
                      className={active ? 'active' : ''}
                      aria-current={active ? 'page' : undefined}
                      onClick={onClose}
                      onPointerEnter={() => prefetch(item.target!)}
                      onPointerDown={() => prefetch(item.target!)}
                      onFocus={() => prefetch(item.target!)}
                    >
                      <Icon size={17} strokeWidth={1.8} />
                      {moduleLabel(item.module)}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="adm-sidebar-foot">
          <Link href="/" onClick={onClose}>
            <Store size={17} strokeWidth={1.8} />
            View storefront
          </Link>
        </div>
      </aside>
    </>
  );
}
