'use client';
import { PageTitle } from '@/components/layout/page-title';
import { Login } from '@/features/auth/login-form';
import { api } from '@/lib/api-client';
import { useStore } from '@/providers/store-provider';
import { permitted } from '@megha/constants';
import { LoadingState } from '@megha/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Inbox, Menu, Plus, RefreshCw, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import {
  adminModules,
  createLabel,
  moduleDescription,
  moduleLabel,
  pageTabs,
  statusTabs,
  viewTabs,
  type AdminModule,
  type AdminRow,
} from './admin-config';
import { AdminDashboard } from './admin-dashboard';
import { exportRows } from './admin-export';
import { fieldsFor } from './admin-form-config';
import { AdminNavigation } from './admin-navigation';
import { AdminTable, statusLabel } from './admin-table';
import { useAdminRecords } from './use-admin-records';
const AdminRecordDetail = dynamic(
  () => import('./admin-record-detail').then((m) => m.AdminRecordDetail),
  { loading: () => <LoadingState>Loading details…</LoadingState> },
);
const AdminOrderDetail = dynamic(
  () => import('./admin-order-detail').then((m) => m.AdminOrderDetail),
  { loading: () => <LoadingState>Loading order…</LoadingState> },
);
const AdminRecordForm = dynamic(
  () => import('./admin-record-form').then((m) => m.AdminRecordForm),
  { loading: () => <LoadingState>Loading form…</LoadingState> },
);

export default function Admin() {
  return (
    <Suspense fallback={<LoadingState>Loading…</LoadingState>}>
      <AdminRoute />
    </Suspense>
  );
}
function AdminRoute() {
  const pathname = usePathname();
  const params = useSearchParams();
  const initialStatus = params.get('status') ?? '';
  const initialView = params.get('view') ?? '';
  // Deep link from the dashboard: /admin/orders?order=<id> opens that order.
  const initialOrder = params.get('order') ?? '';
  const candidate = pathname.split('/')[2] || 'reports';
  const module = adminModules.includes(candidate as AdminModule)
    ? (candidate as AdminModule)
    : 'reports';
  return (
    <AdminModulePage
      key={module + ':' + initialStatus + ':' + initialView + ':' + initialOrder}
      module={module}
      initialStatus={initialStatus}
      initialView={initialView}
      initialOrder={['orders', 'payments'].includes(module) ? initialOrder : ''}
    />
  );
}
function AdminModulePage({
  module,
  initialStatus,
  initialView,
  initialOrder,
}: {
  module: AdminModule;
  initialStatus: string;
  initialView: string;
  initialOrder: string;
}) {
  const { user, authLoading, notice, reloadCatalogue } = useStore();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(initialStatus);
  const [view, setView] = useState(initialView);
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState<AdminRow | null>(
    initialOrder ? { _id: initialOrder } : null,
  );
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const allowed = !!user && permitted(user.role, module);
  // The dashboard loads its own summary rather than a record list.
  const { rows, error, loading, reload, total, pages } = useAdminRecords(
    module,
    allowed && module !== 'reports',
    query,
    page,
    status,
    sort,
    view,
  );
  const shipmentCounts = useQuery({
    queryKey: ['private', user?._id, 'admin', 'shipments', 'summary'],
    enabled: allowed && module === 'shipments',
    queryFn: ({ signal }) =>
      api<{ views: { key: string; label: string; count: number }[]; deliveredToday: number }>(
        '/admin/shipments/summary',
        undefined,
        'GET',
        signal,
      ),
  });
  if (authLoading)
    return (
      <div className="container page">
        <LoadingState>Loading your account…</LoadingState>
      </div>
    );
  if (!user)
    return (
      <div className="container page">
        <PageTitle title="Staff Administration" />
        <Login />
      </div>
    );
  if (user.role === 'CUSTOMER')
    return (
      <div className="container page">
        <PageTitle title="Staff Administration" />
        <p className="error">Your account does not have staff access.</p>
      </div>
    );
  const canCreate = fieldsFor(module, true, user.role).length > 0;
  const canEdit = fieldsFor(module, false, user.role).length > 0;
  const tabs = pageTabs(module).filter((tab) => permitted(user.role, tab));
  const statuses = statusTabs[module] ?? [];
  const statusOptions = status && !statuses.includes(status) ? [...statuses, status] : statuses;
  const views =
    module === 'shipments'
      ? [
          { key: '', label: 'All', count: undefined as number | undefined },
          ...(shipmentCounts.data?.views ?? []),
        ]
      : (viewTabs[module] ?? []).map((tab) => ({ ...tab, count: undefined as number | undefined }));
  // Orders, payments and shipments all open the same order operations screen.
  const orderScreen = ['orders', 'payments', 'shipments'].includes(module);
  const title = moduleLabel(tabs.length ? tabs[0] : module);
  const saved = () => {
    notice('Changes saved.');
    setSelected(null);
    setEditing(false);
    reload();
    if (['products', 'inventory', 'categories', 'machines', 'services'].includes(module))
      reloadCatalogue();
  };
  const closeRecord = () => {
    setSelected(null);
    setEditing(false);
    if (initialOrder) router.replace('/admin/' + module, { scroll: false });
  };
  const recordOpen = editing || !!selected;
  return (
    <div className="adm">
      <AdminNavigation
        module={module}
        user={user}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <div className="adm-main">
        <header className="adm-topbar">
          <button
            className="adm-icon-button adm-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="adm-topbar-title">{title}</span>
          <Link href="/account" className="adm-user">
            <span className="adm-avatar">{user.name.slice(0, 2).toUpperCase()}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{statusLabel(user.role)}</small>
            </span>
          </Link>
        </header>
        <div className="adm-content">
          {recordOpen ? (
            <button className="adm-back" onClick={closeRecord}>
              <ArrowLeft size={16} />
              Back to {moduleLabel(module)}
            </button>
          ) : (
            <div className="adm-page-head">
              <div>
                <h1>{title}</h1>
                <p>{moduleDescription[tabs.length ? tabs[0] : module]}</p>
              </div>
              <div className="adm-head-actions">
                {module !== 'reports' && allowed && (
                  <button
                    className="adm-btn ghost"
                    onClick={reload}
                    disabled={loading}
                    aria-label="Refresh list"
                    title="Refresh"
                  >
                    <RefreshCw size={16} />
                  </button>
                )}
                {canCreate && allowed && (
                  <button
                    className="adm-btn primary"
                    onClick={() => {
                      setSelected(null);
                      setEditing(true);
                    }}
                  >
                    <Plus size={16} />
                    {createLabel[module] ?? 'Create'}
                  </button>
                )}
              </div>
            </div>
          )}
          {!allowed ? (
            <div className="adm-card adm-empty">
              <p>Your role does not include this area. Choose another section from the menu.</p>
            </div>
          ) : recordOpen ? (
            editing ? (
              <AdminRecordForm
                key={String(selected?._id ?? 'new')}
                module={module}
                row={selected ?? undefined}
                onSaved={saved}
                onClose={closeRecord}
              />
            ) : (
              selected &&
              (orderScreen ? (
                <AdminOrderDetail
                  key={String(selected._id)}
                  orderId={String(module === 'shipments' ? selected.orderId : selected._id)}
                />
              ) : (
                <AdminRecordDetail
                  key={String(selected._id)}
                  module={module}
                  row={selected}
                  onSaved={saved}
                  onEdit={canEdit ? () => setEditing(true) : undefined}
                />
              ))
            )
          ) : (
            <>
              {tabs.length > 1 && (
                <nav className="adm-tabs" aria-label={title + ' views'}>
                  {tabs.map((tab) => (
                    <Link
                      key={tab}
                      href={'/admin/' + tab}
                      className={tab === module ? 'active' : ''}
                      aria-current={tab === module ? 'page' : undefined}
                    >
                      {moduleLabel(tab)}
                    </Link>
                  ))}
                </nav>
              )}
              {module === 'reports' ? (
                <AdminDashboard />
              ) : (
                <section className="adm-card adm-list">
                  {views.length > 0 && (
                    <div className="adm-status-tabs" role="tablist" aria-label="Views">
                      {views.map((tab) => (
                        <button
                          key={tab.key || 'all'}
                          role="tab"
                          aria-selected={view === tab.key}
                          onClick={() => {
                            setView(tab.key);
                            setPage(1);
                          }}
                        >
                          {tab.label}
                          {tab.count !== undefined && (
                            <span className="adm-count">{tab.count}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {!views.length && statusOptions.length > 0 && (
                    <div className="adm-status-tabs" role="tablist" aria-label="Filter by status">
                      {['', ...statusOptions].map((value) => (
                        <button
                          key={value || 'all'}
                          role="tab"
                          aria-selected={status === value}
                          onClick={() => {
                            setStatus(value);
                            setPage(1);
                          }}
                        >
                          {value ? statusLabel(value) : 'All'}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="adm-filters">
                    <form
                      className="adm-search"
                      onSubmit={(event) => {
                        event.preventDefault();
                        setQuery(search);
                        setPage(1);
                      }}
                    >
                      <Search size={16} aria-hidden="true" />
                      <input
                        aria-label={'Search ' + moduleLabel(module).toLowerCase()}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={'Search ' + moduleLabel(module).toLowerCase() + '…'}
                      />
                    </form>
                    <select
                      aria-label="Sort records"
                      value={sort}
                      onChange={(event) => {
                        setSort(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="name">Name A–Z</option>
                    </select>
                    <button
                      className="adm-btn ghost"
                      disabled={!rows.length}
                      onClick={() => exportRows(module, rows)}
                    >
                      <Download size={16} />
                      Export
                    </button>
                  </div>
                  {query && (
                    <div className="adm-chips">
                      <button
                        onClick={() => {
                          setSearch('');
                          setQuery('');
                          setPage(1);
                        }}
                      >
                        Search: “{query}” <span aria-hidden="true">×</span>
                        <span className="sr-only">Clear search</span>
                      </button>
                    </div>
                  )}
                  {error ? (
                    <div className="adm-banner warn adm-inset" role="alert">
                      <span>{error}</span>
                      <button className="adm-btn ghost" onClick={reload} disabled={loading}>
                        Retry
                      </button>
                    </div>
                  ) : loading ? (
                    <LoadingState>Loading {moduleLabel(module).toLowerCase()}…</LoadingState>
                  ) : rows.length ? (
                    <AdminTable module={module} rows={rows} onSelect={setSelected} />
                  ) : (
                    <div className="adm-empty">
                      <Inbox size={22} />
                      <p>
                        {query || status ? 'No records match these filters.' : 'Nothing here yet.'}
                      </p>
                    </div>
                  )}
                  {!error && !loading && total > 0 && (
                    <div className="adm-pagination">
                      <span>
                        {total.toLocaleString('en-IN')} {total === 1 ? 'record' : 'records'}
                        {pages > 1 && ` · Page ${page} of ${pages}`}
                      </span>
                      {pages > 1 && (
                        <div>
                          <button
                            className="adm-btn ghost"
                            disabled={page <= 1}
                            onClick={() => setPage((value) => value - 1)}
                          >
                            Previous
                          </button>
                          <button
                            className="adm-btn ghost"
                            disabled={page >= pages}
                            onClick={() => setPage((value) => value + 1)}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
