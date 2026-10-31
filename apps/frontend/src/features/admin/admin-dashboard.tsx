'use client';
import { money } from '@/lib/format';
import { useStore } from '@/providers/store-provider';
import type {
  AdminDashboardData,
  DashboardAttention,
  DashboardMetric,
  DashboardRange,
  DashboardStage,
} from '@megha/types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  CreditCard,
  IndianRupee,
  MessageSquareText,
  Minus,
  Package,
  PackageCheck,
  PackageX,
  Printer,
  Receipt,
  RefreshCw,
  ScanSearch,
  ShoppingBag,
  TrendingDown,
  Undo2,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Badge } from './admin-table';
import { adminDashboardQuery, defaultDashboardRange } from './use-admin-dashboard';

const ranges: { key: DashboardRange; label: string; compare: string }[] = [
  { key: '7d', label: '7 days', compare: 'previous 7 days' },
  { key: '30d', label: '30 days', compare: 'previous 30 days' },
  { key: '90d', label: '90 days', compare: 'previous 90 days' },
  { key: '12m', label: '12 months', compare: 'previous 12 months' },
];
// Every date is shown in Indian time, matching how the API buckets sales.
const date = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...options });
const shortDay = date({ day: 'numeric', month: 'short' });
const fullDay = date({ day: 'numeric', month: 'short', year: 'numeric' });
const weekday = date({ weekday: 'short', day: 'numeric', month: 'short' });
const shortMonth = date({ month: 'short' });
const longMonth = date({ month: 'long', year: 'numeric' });
const clock = date({ hour: 'numeric', minute: '2-digit' });
const compactMoney = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(paise / 100);
const count = (value: number) => value.toLocaleString('en-IN');
const plural = (value: number, word: string) => `${count(value)} ${word}${value === 1 ? '' : 's'}`;
function age(iso: string) {
  const minutes = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return minutes < 2 ? 'just now' : `${Math.floor(minutes)} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  return plural(Math.floor(minutes / 1440), 'day');
}
/** "10 Sept – 9 Oct 2026", with both years when the period crosses into a new year. */
function periodText(fromIso: string, toIso: string) {
  const from = fullDay.format(new Date(fromIso));
  const to = fullDay.format(new Date(toIso));
  return (from.slice(-4) === to.slice(-4) ? shortDay.format(new Date(fromIso)) : from) + ' – ' + to;
}
function relativeTime(iso: string) {
  const minutes = (Date.now() - new Date(iso).getTime()) / 60000;
  if (minutes < 1440) return age(iso) === 'just now' ? 'Just now' : age(iso) + ' ago';
  return minutes < 2880 ? 'Yesterday' : shortDay.format(new Date(iso));
}

const attentionIcons: Record<string, LucideIcon> = {
  exceptions: AlertTriangle,
  rto: Undo2,
  'failed-refunds': CreditCard,
  'payment-review': CreditCard,
  'out-of-stock': PackageX,
  'to-process': ClipboardCheck,
  'to-pack': Package,
  unbooked: PackageCheck,
  'label-ready': Printer,
  'pickup-pending': Clock,
  returns: Undo2,
  'low-stock': TrendingDown,
  enquiries: MessageSquareText,
  spares: ScanSearch,
  service: Wrench,
  unpaid: Clock,
};

export function AdminDashboard() {
  const { user } = useStore();
  const [range, setRange] = useState<DashboardRange>(defaultDashboardRange);
  const { data, error, isFetching, isPlaceholderData, refetch } = useQuery({
    ...adminDashboardQuery(user?._id, range),
    enabled: !!user,
    // Keep the current figures on screen while another period loads.
    placeholderData: keepPreviousData,
  });
  const selected = ranges.find((option) => option.key === range) ?? ranges[1];
  const toolbar = (
    <div className="adm-dash-toolbar">
      <p>
        <CalendarDays size={16} />
        {data ? (
          <>
            <strong>{periodText(data.range.from, data.range.to)}</strong>
            <span>Compared with the {selected.compare}</span>
          </>
        ) : (
          <strong>Loading figures…</strong>
        )}
      </p>
      <div className="adm-dash-controls">
        <div className="adm-segment" role="group" aria-label="Reporting period">
          {ranges.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={range === option.key}
              onClick={() => setRange(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="adm-btn ghost adm-dash-refresh"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Refresh dashboard"
          title={data ? 'Updated ' + clock.format(new Date(data.generatedAt)) : 'Refresh'}
        >
          <RefreshCw size={16} className={isFetching ? 'adm-spin' : undefined} />
        </button>
      </div>
    </div>
  );
  if (!data)
    return (
      <div className="adm-dash">
        {toolbar}
        {error ? (
          <div className="adm-banner warn" role="alert">
            <AlertTriangle size={18} />
            <span>The dashboard could not be loaded. {error.message}</span>
            <button className="adm-btn ghost" onClick={() => void refetch()}>
              Retry
            </button>
          </div>
        ) : (
          <DashboardSkeleton />
        )}
      </div>
    );
  const { kpis, trend, totals } = data;
  const delivered = data.pipeline.find((stage) => stage.key === 'delivered')?.count ?? 0;
  return (
    <div className="adm-dash" aria-busy={isFetching}>
      {toolbar}
      {error && (
        <div className="adm-banner warn" role="alert">
          <AlertTriangle size={18} />
          <span>Showing the last figures loaded. Refresh failed: {error.message}</span>
        </div>
      )}
      <div className={'adm-dash-body' + (isPlaceholderData ? ' is-updating' : '')}>
        <section className="adm-dash-kpis" aria-label="Key figures">
          <Kpi
            icon={IndianRupee}
            label="Net sales"
            value={money(kpis.netSales.value)}
            metric={kpis.netSales}
            compare={selected.compare}
            spark={trend.map((bucket) => bucket.sales)}
            note={`Gross ${money(kpis.grossSales.value)} · Refunds ${money(kpis.refunds.value)}`}
          />
          <Kpi
            icon={ShoppingBag}
            label="Paid orders"
            value={count(kpis.orders.value)}
            metric={kpis.orders}
            compare={selected.compare}
            spark={trend.map((bucket) => bucket.orders)}
            note={`${count(delivered)} delivered in this period`}
          />
          <Kpi
            icon={Receipt}
            label="Average order value"
            value={money(kpis.averageOrder.value)}
            metric={kpis.averageOrder}
            compare={selected.compare}
            note="Gross sales per paid order"
          />
          <Kpi
            icon={Users}
            label="New customers"
            value={count(kpis.customers.value)}
            metric={kpis.customers}
            compare={selected.compare}
            note={`${plural(totals.customers, 'customer')} in total`}
          />
        </section>
        <div className="adm-dash-row adm-dash-row-main">
          <SalesChart data={data} />
          <Attention items={data.attention} />
        </div>
        <Pipeline stages={data.pipeline} />
        <div className="adm-dash-row adm-dash-row-split">
          <RecentOrders orders={data.recentOrders} />
          <TopProducts products={data.topProducts} />
        </div>
        <div className="adm-dash-row adm-dash-row-even">
          <InventoryHealth inventory={data.inventory} />
          <Requests requests={data.requests} />
        </div>
      </div>
    </div>
  );
}

function Delta({ metric }: { metric: DashboardMetric }) {
  const { value, previous } = metric;
  if (!previous)
    return value ? (
      <span className="adm-delta up">
        <ArrowUpRight size={13} />
        New
      </span>
    ) : (
      <span className="adm-delta flat">
        <Minus size={13} />
        No change
      </span>
    );
  const change = ((value - previous) / Math.abs(previous)) * 100;
  if (Math.abs(change) < 0.05)
    return (
      <span className="adm-delta flat">
        <Minus size={13} />
        0%
      </span>
    );
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={'adm-delta ' + (change > 0 ? 'up' : 'down')}>
      <Icon size={13} />
      {Math.abs(change).toFixed(Math.abs(change) < 10 ? 1 : 0)}%
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2 || !values.some(Boolean)) return <span className="adm-spark" />;
  const max = Math.max(...values);
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * 100},${28 - (value / max) * 24}`)
    .join(' ');
  return (
    <svg className="adm-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`0,30 ${points} 100,30`} />
      <polyline points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  metric,
  compare,
  note,
  spark,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  metric: DashboardMetric;
  compare: string;
  note: string;
  spark?: number[];
}) {
  return (
    <article className="adm-card adm-kpi">
      <header>
        <span className="adm-kpi-icon">
          <Icon size={16} strokeWidth={1.9} />
        </span>
        {label}
      </header>
      <strong className="adm-kpi-value">{value}</strong>
      <p className="adm-kpi-compare">
        <Delta metric={metric} />
        <span>vs {compare}</span>
      </p>
      {spark ? <Sparkline values={spark} /> : <span className="adm-spark" />}
      <p className="adm-kpi-note">{note}</p>
    </article>
  );
}

/** Round an axis step up to 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(raw: number) {
  if (raw <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return ([1, 2, 2.5, 5, 10].find((nice) => unit <= nice) ?? 10) * power;
}

function SalesChart({ data }: { data: AdminDashboardData }) {
  const { trend, range, kpis } = data;
  const max = Math.max(0, ...trend.map((bucket) => bucket.sales));
  const step = niceStep(max / 4);
  const top = step * 4 || 1;
  // Five gridlines; with no sales only the zero line is labelled.
  const ticks = [4, 3, 2, 1, 0].map((index) => index * step);
  // Every month of a year is labelled; longer series get about eight labels.
  const every = trend.length <= 12 ? 1 : Math.ceil(trend.length / 8);
  const axisLabel = (iso: string) =>
    range.bucket === 'month' ? shortMonth.format(new Date(iso)) : shortDay.format(new Date(iso));
  const tipLabel = (iso: string) => {
    const start = new Date(iso);
    if (range.bucket === 'month') return longMonth.format(start);
    if (range.bucket === 'week')
      return `Week of ${shortDay.format(start)} – ${shortDay.format(new Date(start.getTime() + 6 * 86400000))}`;
    return weekday.format(start);
  };
  const columns = { gridTemplateColumns: `repeat(${trend.length}, minmax(0, 1fr))` };
  return (
    <section className="adm-card adm-dash-chart">
      <header className="adm-card-head">
        <div>
          <h2>Sales</h2>
          <p>Paid orders by {range.bucket}, before refunds</p>
        </div>
        <div className="adm-dash-figure">
          <strong>{money(kpis.grossSales.value)}</strong>
          <span>{plural(kpis.orders.value, 'paid order')}</span>
        </div>
      </header>
      <div className="adm-chart">
        <div className="adm-chart-axis" aria-hidden="true">
          {ticks.map((tick, index) => (
            <span key={index}>{step || index === 4 ? compactMoney(tick) : ''}</span>
          ))}
        </div>
        <div className="adm-chart-plot">
          <div className="adm-chart-lines" aria-hidden="true">
            {ticks.map((_, index) => (
              <span key={index} />
            ))}
          </div>
          <ol className="adm-chart-bars" style={columns} aria-label={`Sales by ${range.bucket}`}>
            {trend.map((bucket, index) => {
              const height = (bucket.sales / top) * 100;
              const edge =
                index < trend.length * 0.2 ? ' start' : index > trend.length * 0.8 ? ' end' : '';
              return (
                <li
                  key={bucket.start}
                  tabIndex={0}
                  className={(bucket.sales ? '' : 'zero') + edge || undefined}
                  style={{ '--bar': height + '%' } as CSSProperties}
                  aria-label={`${tipLabel(bucket.start)}: ${money(bucket.sales)}, ${plural(bucket.orders, 'order')}`}
                >
                  <span className="adm-chart-bar" />
                  <span className={'adm-chart-tip' + edge} role="presentation">
                    <strong>{money(bucket.sales)}</strong>
                    <span>{tipLabel(bucket.start)}</span>
                    <span>{plural(bucket.orders, 'paid order')}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {max === 0 && <p className="adm-chart-empty">No paid orders in this period</p>}
        </div>
        <div className="adm-chart-x" style={columns} aria-hidden="true">
          {trend.map((bucket, index) => (
            // Phones hide every other label (the odd ones) so they never collide.
            <span key={bucket.start} className={(index / every) % 2 === 1 ? 'odd' : undefined}>
              {index % every === 0 ? axisLabel(bucket.start) : ''}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Attention({ items }: { items: DashboardAttention[] }) {
  const urgent = items.filter((item) => item.tone === 'danger').length;
  return (
    <section className="adm-card adm-dash-attention">
      <header className="adm-card-head">
        <div>
          <h2>Needs attention</h2>
          <p>Work waiting on the team, most urgent first</p>
        </div>
        {items.length > 0 && (
          <span className={'adm-badge ' + (urgent ? 'danger' : 'warning')}>
            {plural(items.length, 'item')}
          </span>
        )}
      </header>
      {items.length ? (
        <ul className="adm-attention">
          {items.map((item) => {
            const Icon = attentionIcons[item.key] ?? AlertTriangle;
            return (
              <li key={item.key}>
                <Link href={item.href} className={'tone-' + item.tone}>
                  <span className="adm-attention-icon">
                    <Icon size={16} strokeWidth={1.9} />
                  </span>
                  <span className="adm-attention-text">
                    <strong>{item.label}</strong>
                    {item.since && <small>Oldest waiting {age(item.since)}</small>}
                  </span>
                  <span className="adm-attention-count">{count(item.count)}</span>
                  <ChevronRight size={16} className="adm-attention-go" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      {items.length > 0 && items.length < 16 && (
        <p className="adm-attention-foot">
          <CheckCircle2 size={15} />
          Every other queue is clear.
        </p>
      )}
      {!items.length && (
        <div className="adm-dash-clear">
          <CheckCircle2 size={28} />
          <strong>All caught up</strong>
          <p>No orders, shipments, stock or requests need action right now.</p>
        </div>
      )}
    </section>
  );
}

function Pipeline({ stages }: { stages: DashboardStage[] }) {
  return (
    <section className="adm-card adm-dash-pipeline">
      <header className="adm-card-head">
        <div>
          <h2>Order pipeline</h2>
          <p>Orders at each stage right now; delivered counts the selected period</p>
        </div>
        <Link href="/admin/orders" className="adm-link">
          All orders
        </Link>
      </header>
      <ol className="adm-pipeline">
        {stages.map((stage) => (
          <li key={stage.key}>
            <Link href={stage.href} className={stage.count ? 'active' : undefined}>
              <span>{stage.label}</span>
              <strong>{count(stage.count)}</strong>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CardHead({
  title,
  note,
  href,
  action,
}: {
  title: string;
  note?: string;
  href?: string;
  action?: string;
}) {
  return (
    <header className="adm-card-head">
      <div>
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </div>
      {href && (
        <Link href={href} className="adm-link">
          {action}
        </Link>
      )}
    </header>
  );
}

function Empty({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="adm-dash-empty">
      <Icon size={20} strokeWidth={1.8} />
      <p>{children}</p>
    </div>
  );
}

function RecentOrders({ orders }: { orders: AdminDashboardData['recentOrders'] }) {
  return (
    <section className="adm-card">
      <CardHead
        title="Recent orders"
        note="Latest orders, newest first"
        href="/admin/orders"
        action="View all"
      />
      {orders.length ? (
        <ul className="adm-dash-orders">
          {orders.map((order) => (
            <li key={order._id}>
              <Link href={'/admin/orders?order=' + order._id}>
                <span className="adm-dash-order-id">
                  <strong className="adm-mono">{order.number}</strong>
                  <small>
                    {order.customer || 'Customer'} · {plural(order.items, 'item')}
                  </small>
                </span>
                <span className="adm-dash-order-time">{relativeTime(order.createdAt)}</span>
                <span className="adm-dash-order-total">{money(order.total)}</span>
                <Badge status={order.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty icon={ShoppingBag}>
          No orders yet. New orders appear here as soon as they are placed.
        </Empty>
      )}
    </section>
  );
}

function TopProducts({ products }: { products: AdminDashboardData['topProducts'] }) {
  const best = Math.max(1, ...products.map((product) => product.sales));
  return (
    <section className="adm-card">
      <CardHead
        title="Top products"
        note="By sales in this period"
        href="/admin/products"
        action="Products"
      />
      {products.length ? (
        <ol className="adm-dash-top">
          {products.map((product, index) => (
            <li key={product.productId}>
              <span className="adm-dash-rank">{index + 1}</span>
              <span className="adm-dash-top-name">
                <strong>{product.name}</strong>
                <small>
                  {product.sku} · {count(product.quantity)} sold
                </small>
                <span className="adm-meter" aria-hidden="true">
                  <span style={{ width: (product.sales / best) * 100 + '%' }} />
                </span>
              </span>
              <span className="adm-dash-top-sales">{money(product.sales)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <Empty icon={Boxes}>No products sold in this period.</Empty>
      )}
    </section>
  );
}

function InventoryHealth({ inventory }: { inventory: AdminDashboardData['inventory'] }) {
  const { active, healthy, low, out, lowest, stockValue } = inventory;
  const legend = [
    { key: 'ok', label: 'In stock', value: healthy, href: '/admin/inventory' },
    { key: 'low', label: 'Low stock', value: low, href: '/admin/inventory?view=low' },
    { key: 'out', label: 'Out of stock', value: out, href: '/admin/inventory?view=out' },
  ];
  return (
    <section className="adm-card">
      <CardHead
        title="Inventory health"
        note={`${plural(active, 'active product')}`}
        href="/admin/inventory"
        action="Open inventory"
      />
      <div className="adm-card-body adm-dash-stock">
        <div
          className="adm-stockbar"
          role="img"
          aria-label={`${healthy} in stock, ${low} low, ${out} out of stock`}
        >
          {legend.map((part) =>
            part.value ? (
              <span key={part.key} className={part.key} style={{ flexGrow: part.value }} />
            ) : null,
          )}
        </div>
        <ul className="adm-stock-legend">
          {legend.map((part) => (
            <li key={part.key}>
              <Link href={part.href}>
                <i className={part.key} />
                {part.label}
                <strong>{count(part.value)}</strong>
              </Link>
            </li>
          ))}
        </ul>
        <p className="adm-dash-note">
          Stock value <strong>{money(stockValue)}</strong> at current selling prices, before GST
        </p>
        <h3>Lowest stock</h3>
        {lowest.length ? (
          <ul className="adm-dash-lowest">
            {lowest.map((product) => (
              <li key={product._id}>
                <Link href={'/admin/inventory?view=' + (product.available > 0 ? 'low' : 'out')}>
                  <span>
                    <strong>{product.name}</strong>
                    <small className="adm-mono">{product.sku}</small>
                  </span>
                  <span className="adm-dash-lowest-qty">
                    {count(Math.max(0, product.available))} left
                    <small>reorder at {count(product.threshold)}</small>
                  </span>
                  <Badge status={product.available > 0 ? 'LOW' : 'OUT_OF_STOCK'} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="adm-dash-ok">
            <CheckCircle2 size={16} />
            Every product is above its low-stock level.
          </p>
        )}
      </div>
    </section>
  );
}

function RequestBlock({
  icon: Icon,
  title,
  href,
  open,
  received,
  stages,
  empty,
}: {
  icon: LucideIcon;
  title: string;
  href: string;
  open: number;
  received: number;
  stages?: DashboardStage[];
  empty: string;
}) {
  const active = (stages ?? []).filter((stage) => stage.count > 0);
  return (
    <div className="adm-request">
      <Link href={href} className="adm-request-head">
        <span className="adm-kpi-icon">
          <Icon size={16} strokeWidth={1.9} />
        </span>
        <span>
          <strong>{title}</strong>
          <small>{count(received)} received in this period</small>
        </span>
        <span className="adm-request-open">
          <strong>{count(open)}</strong>
          <small>open</small>
        </span>
      </Link>
      {stages &&
        (active.length ? (
          <ul className="adm-request-stages">
            {active.map((stage) => (
              <li key={stage.key}>
                <Link href={stage.href}>
                  {stage.label}
                  <strong>{count(stage.count)}</strong>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="adm-request-empty">{empty}</p>
        ))}
    </div>
  );
}

function Requests({ requests }: { requests: AdminDashboardData['requests'] }) {
  return (
    <section className="adm-card">
      <CardHead title="Enquiries & service" note="Open customer requests by stage" />
      <div className="adm-card-body adm-dash-requests">
        <RequestBlock
          icon={MessageSquareText}
          title="Enquiries & quotations"
          href="/admin/enquiries"
          open={requests.enquiries.open}
          received={requests.enquiries.received}
          stages={requests.enquiries.stages}
          empty="No open enquiries."
        />
        <RequestBlock
          icon={Wrench}
          title="Service requests"
          href="/admin/service-requests"
          open={requests.service.open}
          received={requests.service.received}
          stages={requests.service.stages}
          empty="No open service requests."
        />
        <RequestBlock
          icon={ScanSearch}
          title="Find My Spare"
          href="/admin/find-my-spare"
          open={requests.spares.open}
          received={requests.spares.received}
          empty=""
        />
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="adm-dash-body" aria-hidden="true">
      <div className="adm-dash-kpis">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="adm-card adm-skeleton tall" />
        ))}
      </div>
      <div className="adm-dash-row adm-dash-row-main">
        <div className="adm-card adm-skeleton chart" />
        <div className="adm-card adm-skeleton chart" />
      </div>
    </div>
  );
}
