import type {
  AdminDashboardData,
  DashboardAttention,
  DashboardRange,
  DashboardStage,
} from '@megha/types';
import { dashboardQuerySchema } from '@megha/validation';
import type { PipelineStage } from 'mongoose';
import { Order } from '../orders/order.model';
import { inventoryViews, stockFields } from '../products/inventory-views';
import { Product } from '../products/product.model';
import { Entity } from '../records/record.model';
import { Refund } from '../refunds/refund.model';
import { Return } from '../returns/return.model';
import { Shipment } from '../shipments/shipment.model';
import { orderViews, shipmentViews } from '../shipments/shipment-views';
import { User } from '../users/user.model';

const DAY = 86400000;
/** India Standard Time has no daylight saving, so a fixed offset gives exact local days. */
const IST = 330 * 60000;
/** Money was received for a sale. REFUND_REQUIRED (paid after cancellation) is not a sale. */
const paidStatuses = ['CAPTURED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'];

const dayStart = (date: Date) => new Date(Math.floor((date.getTime() + IST) / DAY) * DAY - IST);
function monthStart(now: Date, monthsBack: number) {
  const local = new Date(now.getTime() + IST);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - monthsBack, 1) - IST);
}

/**
 * The selected period in Indian days, its chart buckets, and the comparison window: the same
 * elapsed time immediately before, so a part-finished today is compared fairly.
 */
export function periodFor(range: DashboardRange, now = new Date()) {
  let from: Date, previousFrom: Date, starts: Date[], bucket: 'day' | 'week' | 'month';
  if (range === '12m') {
    starts = Array.from({ length: 12 }, (_, i) => monthStart(now, 11 - i));
    from = starts[0];
    previousFrom = monthStart(now, 23);
    bucket = 'month';
  } else {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 91;
    const step = range === '90d' ? 7 : 1;
    from = new Date(dayStart(now).getTime() - (days - 1) * DAY);
    previousFrom = new Date(from.getTime() - days * DAY);
    starts = Array.from(
      { length: days / step },
      (_, i) => new Date(from.getTime() + i * step * DAY),
    );
    bucket = step === 7 ? 'week' : 'day';
  }
  const previousTo = new Date(previousFrom.getTime() + (now.getTime() - from.getTime()));
  return { from, to: now, previousFrom, previousTo, starts, bucket };
}

type Counted = { count: number; since: Date | null; orderId?: string };
const counted = (
  filter: Record<string, unknown>,
  date: string | Record<string, unknown> = '$createdAt',
): PipelineStage[] => [
  { $match: filter },
  { $sort: { createdAt: -1 } },
  {
    $group: {
      _id: null,
      count: { $sum: 1 },
      since: { $min: date },
      orderId: { $first: '$orderId' },
    },
  },
];
const first = (rows: Counted[]): Counted => rows[0] ?? { count: 0, since: null };
/** One affected order opens directly; several open the list. */
const target = (row: Counted, list: string) =>
  row.count === 1 && row.orderId ? '/admin/orders?order=' + row.orderId : list;

const enquiryStages = [
  ['NEW', 'New'],
  ['CONTACTED', 'Contacted'],
  ['QUOTE_PREPARED', 'Quote prepared'],
  ['QUOTE_SENT', 'Quote sent'],
  ['NEGOTIATION', 'Negotiation'],
  ['ACCEPTED', 'Accepted'],
];
const serviceStages = [
  ['NEW', 'New'],
  ['TRIAGED', 'Triaged'],
  ['ASSIGNED', 'Assigned'],
  ['SCHEDULED', 'Scheduled'],
  ['IN_PROGRESS', 'In progress'],
  ['WAITING_FOR_PARTS', 'Waiting for parts'],
  ['WAITING_FOR_CUSTOMER', 'Waiting for customer'],
];
const closedRequests = ['CLOSED', 'CONVERTED', 'LOST', 'REJECTED', 'EXPIRED', 'RESOLVED'];
const closedService = ['COMPLETED', 'CLOSED', 'CANCELLED'];

/** Admin dashboard: period performance, live work queues and stock, all from stored records. */
export async function dashboard(query: unknown): Promise<AdminDashboardData> {
  const { range } = dashboardQuerySchema.parse(query);
  const { from, to, previousFrom, previousTo, starts, bucket } = periodFor(range);
  const paidSince = (since: Date) => ({
    paymentStatus: { $in: paidStatuses },
    $or: [{ confirmedAt: { $gte: since } }, { confirmedAt: null, createdAt: { $gte: since } }],
  });
  type Totals = { sales: number; orders: number };
  type SalesFacets = {
    current: Totals[];
    previous: Totals[];
    trend: { _id: Date | string; sales: number; orders: number }[];
    top: { _id: string; name: string; sku: string; quantity: number; sales: number }[];
  };
  const totals = { $group: { _id: null, sales: { $sum: '$total' }, orders: { $sum: 1 } } };
  const refundTotals = (start: Date, end: Date) =>
    Refund.aggregate<{ amount: number }>([
      { $match: { status: 'PROCESSED', processedAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);
  const [
    [sales],
    refundsNow,
    refundsBefore,
    customersNow,
    customersBefore,
    [stock],
    requestRows,
    recent,
    pipelineCounts,
    deliveredInPeriod,
    queues,
    totalCustomers,
    totalOrders,
  ] = await Promise.all([
    Order.aggregate<SalesFacets>([
      { $match: paidSince(previousFrom) },
      { $addFields: { paidAt: { $ifNull: ['$confirmedAt', '$createdAt'] } } },
      {
        $facet: {
          current: [{ $match: { paidAt: { $gte: from, $lte: to } } }, totals],
          previous: [{ $match: { paidAt: { $gte: previousFrom, $lt: previousTo } } }, totals],
          trend: [
            { $match: { paidAt: { $gte: from, $lte: to } } },
            {
              $bucket: {
                groupBy: '$paidAt',
                boundaries: [...starts, new Date(to.getTime() + 1)],
                default: 'other',
                output: { sales: { $sum: '$total' }, orders: { $sum: 1 } },
              },
            },
          ],
          top: [
            { $match: { paidAt: { $gte: from, $lte: to } } },
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.productId',
                name: { $last: '$items.name' },
                sku: { $last: '$items.sku' },
                quantity: { $sum: '$items.quantity' },
                sales: { $sum: '$items.total' },
              },
            },
            { $sort: { sales: -1, quantity: -1 } },
            { $limit: 5 },
          ],
        },
      },
    ]),
    refundTotals(from, new Date(to.getTime() + 1)),
    refundTotals(previousFrom, previousTo),
    User.countDocuments({ role: 'CUSTOMER', createdAt: { $gte: from, $lte: to } }),
    User.countDocuments({ role: 'CUSTOMER', createdAt: { $gte: previousFrom, $lt: previousTo } }),
    Product.aggregate<{
      summary: { active: number; low: number; out: number; stockValue: number }[];
      lowest: { _id: unknown; name: string; sku: string; available: number; threshold: number }[];
    }>([
      { $match: { active: true } },
      { $addFields: stockFields },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                active: { $sum: 1 },
                out: { $sum: { $cond: [{ $lte: ['$available', 0] }, 1, 0] } },
                low: {
                  $sum: {
                    $cond: [
                      { $and: [{ $gt: ['$available', 0] }, { $lte: ['$available', '$limit'] }] },
                      1,
                      0,
                    ],
                  },
                },
                // Stock on hand at the current selling price, before tax.
                stockValue: {
                  $sum: { $multiply: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$price', 0] }] },
                },
              },
            },
          ],
          lowest: [
            { $match: { $expr: { $lte: ['$available', '$limit'] } } },
            { $sort: { available: 1, name: 1 } },
            { $limit: 5 },
            { $project: { name: 1, sku: 1, available: 1, threshold: '$limit' } },
          ],
        },
      },
    ]),
    Entity.aggregate<{ _id: { kind: string; status: string }; count: number; recent: number }>([
      { $match: { kind: { $in: ['enquiries', 'service-requests', 'find-my-spare'] } } },
      {
        $group: {
          _id: { kind: '$kind', status: '$status' },
          count: { $sum: 1 },
          recent: { $sum: { $cond: [{ $gte: ['$createdAt', from] }, 1, 0] } },
        },
      },
    ]),
    Order.find(
      {},
      {
        number: 1,
        'customer.name': 1,
        'items.quantity': 1,
        total: 1,
        status: 1,
        paymentStatus: 1,
        createdAt: 1,
      },
    )
      .sort({ createdAt: -1, _id: -1 })
      .limit(6)
      .lean(),
    Promise.all([
      Order.countDocuments({ status: 'PENDING_PAYMENT' }),
      Order.countDocuments(orderViews.paid()),
      Order.countDocuments(orderViews.processing()),
      Order.countDocuments(orderViews.packed()),
      Order.countDocuments(orderViews['ready-to-ship']()),
      Order.countDocuments(orderViews.shipped()),
    ]),
    Order.countDocuments({
      status: 'DELIVERED',
      $or: [{ deliveredAt: { $gte: from } }, { deliveredAt: null, updatedAt: { $gte: from } }],
    }),
    Promise.all([
      Shipment.aggregate<Counted>(counted(shipmentViews.exceptions.filter(), '$updatedAt')),
      Shipment.aggregate<Counted>(
        counted({ status: 'RTO_DELIVERED', 'rto.inspectedAt': null }, '$updatedAt'),
      ),
      Refund.aggregate<Counted>(counted({ status: 'FAILED' })),
      Order.aggregate<Counted>(
        counted({ paymentStatus: { $in: ['REFUND_REQUIRED', 'AUTHORIZED'] } }, '$updatedAt'),
      ),
      Order.aggregate<Counted>(
        counted(orderViews.paid(), { $ifNull: ['$confirmedAt', '$createdAt'] }),
      ),
      Order.aggregate<Counted>(counted(orderViews.processing(), '$updatedAt')),
      Shipment.aggregate<Counted>(counted(shipmentViews['ready-to-ship'].filter())),
      Shipment.aggregate<Counted>(counted(shipmentViews['label-ready'].filter(), '$updatedAt')),
      Shipment.aggregate<Counted>(counted(shipmentViews['pickup-pending'].filter(), '$updatedAt')),
      Return.aggregate<Counted>(counted({ status: 'REQUESTED' })),
      Product.countDocuments(inventoryViews.out()),
      Product.countDocuments(inventoryViews.low()),
      Entity.aggregate<Counted>(counted({ kind: 'enquiries', status: 'NEW' })),
      Entity.aggregate<Counted>(counted({ kind: 'find-my-spare', status: 'NEW' })),
      Entity.aggregate<Counted>(counted({ kind: 'service-requests', status: 'NEW' })),
      Order.aggregate<Counted>(counted({ status: 'PENDING_PAYMENT' })),
    ]),
    User.countDocuments({ role: 'CUSTOMER' }),
    Order.countDocuments({ status: { $ne: 'PENDING_PAYMENT' } }),
  ]);

  const current = sales?.current[0] ?? { sales: 0, orders: 0 };
  const previous = sales?.previous[0] ?? { sales: 0, orders: 0 };
  const refunded = { value: refundsNow[0]?.amount ?? 0, previous: refundsBefore[0]?.amount ?? 0 };
  const byStart = new Map(
    (sales?.trend ?? []).map((row) => [row._id instanceof Date ? row._id.getTime() : 0, row]),
  );

  const [
    exceptions,
    rto,
    failedRefunds,
    paymentReview,
    toProcess,
    toPack,
    unbooked,
    labels,
    pickups,
    returnsRequested,
    outOfStock,
    lowStock,
    newEnquiries,
    newSpares,
    newService,
    unpaid,
  ] = queues.map((row) => (typeof row === 'number' ? row : first(row))) as [
    Counted,
    Counted,
    Counted,
    Counted,
    Counted,
    Counted,
    Counted,
    Counted,
    Counted,
    Counted,
    number,
    number,
    Counted,
    Counted,
    Counted,
    Counted,
  ];
  const item = (
    key: string,
    label: string,
    tone: DashboardAttention['tone'],
    row: Counted | number,
    href: string,
  ): DashboardAttention =>
    typeof row === 'number'
      ? { key, label, tone, count: row, href, since: null }
      : { key, label, tone, count: row.count, href, since: row.since?.toISOString() ?? null };
  const attention = [
    item(
      'exceptions',
      'Delivery exceptions',
      'danger',
      exceptions,
      '/admin/shipments?view=exceptions',
    ),
    item('rto', 'Returned parcels to inspect', 'danger', rto, '/admin/shipments?view=ndr-rto'),
    item(
      'failed-refunds',
      'Failed refunds',
      'danger',
      failedRefunds,
      target(failedRefunds, '/admin/payments'),
    ),
    item('payment-review', 'Payments to review', 'danger', paymentReview, '/admin/payments'),
    item('out-of-stock', 'Out of stock', 'danger', outOfStock, '/admin/inventory?view=out'),
    item('to-process', 'Paid orders to process', 'warning', toProcess, '/admin/orders?view=paid'),
    item('to-pack', 'Orders to pack', 'warning', toPack, '/admin/orders?view=processing'),
    item(
      'unbooked',
      'Packed, shipment not booked',
      'warning',
      unbooked,
      '/admin/shipments?view=ready-to-ship',
    ),
    item('label-ready', 'Labels to print', 'warning', labels, '/admin/shipments?view=label-ready'),
    item(
      'pickup-pending',
      'Pickups to schedule',
      'warning',
      pickups,
      '/admin/shipments?view=pickup-pending',
    ),
    item(
      'returns',
      'Return requests to review',
      'warning',
      returnsRequested,
      '/admin/orders?view=returns',
    ),
    item('low-stock', 'Low stock', 'warning', lowStock, '/admin/inventory?view=low'),
    item('enquiries', 'New enquiries', 'info', newEnquiries, '/admin/enquiries?status=NEW'),
    item('spares', 'New spare part requests', 'info', newSpares, '/admin/find-my-spare?status=NEW'),
    item(
      'service',
      'Service requests to assign',
      'info',
      newService,
      '/admin/service-requests?status=NEW',
    ),
    item(
      'unpaid',
      'Orders awaiting payment',
      'info',
      unpaid,
      '/admin/payments?status=PENDING_PAYMENT',
    ),
  ].filter((entry) => entry.count > 0);

  const [awaiting, paid, processing, packed, ready, shipped] = pipelineCounts;
  const pipeline: DashboardStage[] = [
    {
      key: 'awaiting',
      label: 'Awaiting payment',
      count: awaiting,
      href: '/admin/payments?status=PENDING_PAYMENT',
    },
    { key: 'paid', label: 'To process', count: paid, href: '/admin/orders?view=paid' },
    {
      key: 'processing',
      label: 'Packing',
      count: processing,
      href: '/admin/orders?view=processing',
    },
    { key: 'packed', label: 'Packed', count: packed, href: '/admin/orders?view=packed' },
    {
      key: 'ready',
      label: 'Ready to ship',
      count: ready,
      href: '/admin/orders?view=ready-to-ship',
    },
    { key: 'shipped', label: 'With courier', count: shipped, href: '/admin/orders?view=shipped' },
    {
      key: 'delivered',
      label: 'Delivered',
      count: deliveredInPeriod,
      href: '/admin/orders?view=delivered',
    },
  ];

  const requestCount = (kind: string, statuses?: string[], recentOnly = false) =>
    requestRows
      .filter(
        (row) => row._id.kind === kind && (statuses ? statuses.includes(row._id.status) : true),
      )
      .reduce((sum, row) => sum + (recentOnly ? row.recent : row.count), 0);
  const openCount = (kind: string, closed: string[]) =>
    requestRows
      .filter((row) => row._id.kind === kind && !closed.includes(row._id.status))
      .reduce((sum, row) => sum + row.count, 0);
  const stages = (kind: string, list: string[][]): DashboardStage[] =>
    list.map(([status, label]) => ({
      key: status,
      label,
      count: requestCount(kind, [status]),
      href: `/admin/${kind}?status=${status}`,
    }));

  const { active, low, out, stockValue } = stock?.summary[0] ?? {
    active: 0,
    low: 0,
    out: 0,
    stockValue: 0,
  };
  return {
    range: { key: range, from: from.toISOString(), to: to.toISOString(), bucket },
    generatedAt: new Date().toISOString(),
    kpis: {
      netSales: {
        value: current.sales - refunded.value,
        previous: previous.sales - refunded.previous,
      },
      grossSales: { value: current.sales, previous: previous.sales },
      refunds: refunded,
      orders: { value: current.orders, previous: previous.orders },
      averageOrder: {
        value: current.orders ? Math.round(current.sales / current.orders) : 0,
        previous: previous.orders ? Math.round(previous.sales / previous.orders) : 0,
      },
      customers: { value: customersNow, previous: customersBefore },
    },
    trend: starts.map((start) => {
      const row = byStart.get(start.getTime());
      return { start: start.toISOString(), sales: row?.sales ?? 0, orders: row?.orders ?? 0 };
    }),
    attention,
    pipeline,
    recentOrders: recent.map((order) => ({
      _id: String(order._id),
      number: order.number ?? '',
      customer: order.customer?.name ?? '',
      items: (order.items ?? []).reduce((sum, line) => sum + (line.quantity ?? 0), 0),
      total: order.total ?? 0,
      status: order.status ?? '',
      paymentStatus: order.paymentStatus ?? '',
      createdAt: (order.createdAt as Date).toISOString(),
    })),
    topProducts: (sales?.top ?? []).map((row) => ({
      productId: String(row._id),
      name: row.name,
      sku: row.sku,
      quantity: row.quantity,
      sales: row.sales,
    })),
    inventory: {
      active,
      low,
      out,
      stockValue,
      healthy: active - low - out,
      lowest: (stock?.lowest ?? []).map((row) => ({
        _id: String(row._id),
        name: row.name,
        sku: row.sku,
        available: row.available,
        threshold: row.threshold,
      })),
    },
    requests: {
      enquiries: {
        open: openCount('enquiries', closedRequests),
        received: requestCount('enquiries', undefined, true),
        stages: stages('enquiries', enquiryStages),
      },
      service: {
        open: openCount('service-requests', closedService),
        received: requestCount('service-requests', undefined, true),
        stages: stages('service-requests', serviceStages),
      },
      spares: {
        open: openCount('find-my-spare', closedRequests),
        received: requestCount('find-my-spare', undefined, true),
      },
    },
    totals: { customers: totalCustomers, products: active, orders: totalOrders },
  };
}
