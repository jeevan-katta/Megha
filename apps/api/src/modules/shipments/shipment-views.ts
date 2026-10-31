import { Shipment } from './shipment.model';

type Filter = Record<string, unknown>;
const inCourierHands = ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERY_EXCEPTION', 'NDR'];
const notPickedUp = {
  $in: [
    'NOT_CREATED',
    'CREATED',
    'COURIER_ASSIGNED',
    'AWB_GENERATED',
    'LABEL_GENERATED',
    'LABEL_PRINTED',
    'PICKUP_SCHEDULED',
  ],
};

/** Operational queues for the Shipments page. Each answers one "what needs doing" question. */
export const shipmentViews: Record<string, { label: string; filter: () => Filter }> = {
  'ready-to-ship': {
    label: 'Ready to Ship',
    filter: () => ({ active: true, status: 'NOT_CREATED' }),
  },
  created: { label: 'Shipment Created', filter: () => ({ active: true, status: 'CREATED' }) },
  'awb-generated': {
    label: 'AWB Generated',
    filter: () => ({ active: true, status: { $in: ['COURIER_ASSIGNED', 'AWB_GENERATED'] } }),
  },
  'label-ready': {
    label: 'Label Ready',
    filter: () => ({
      active: true,
      labelUrl: { $type: 'string' },
      labelPrinted: false,
      status: notPickedUp,
    }),
  },
  'label-printed': {
    label: 'Label Printed',
    filter: () => ({ active: true, labelPrinted: true, status: notPickedUp }),
  },
  'pickup-pending': {
    label: 'Pickup Pending',
    filter: () => ({
      active: true,
      awb: { $type: 'string' },
      pickupStatus: { $in: ['NOT_SCHEDULED', 'FAILED'] },
      status: notPickedUp,
    }),
  },
  'pickup-scheduled': {
    label: 'Pickup Scheduled',
    filter: () => ({ active: true, pickupStatus: 'SCHEDULED', status: notPickedUp }),
  },
  shipped: { label: 'Shipped', filter: () => ({ status: { $in: inCourierHands } }) },
  'in-transit': {
    label: 'In Transit',
    filter: () => ({ status: { $in: ['PICKED_UP', 'IN_TRANSIT'] } }),
  },
  'out-for-delivery': { label: 'Out for Delivery', filter: () => ({ status: 'OUT_FOR_DELIVERY' }) },
  delivered: { label: 'Delivered', filter: () => ({ status: 'DELIVERED' }) },
  exceptions: {
    label: 'Exceptions',
    filter: () => ({
      $or: [
        { status: { $in: ['DELIVERY_EXCEPTION', 'NDR'] } },
        { active: true, pickupStatus: 'FAILED' },
        { active: true, 'lastError.step': { $type: 'string' } },
      ],
    }),
  },
  'ndr-rto': {
    label: 'NDR / RTO',
    filter: () => ({
      status: { $in: ['NDR', 'RTO_INITIATED', 'RTO_IN_TRANSIT', 'RTO_DELIVERED'] },
    }),
  },
  cancelled: { label: 'Cancelled', filter: () => ({ status: 'CANCELLED' }) },
};

/** Order list tabs. */
export const orderViews: Record<string, () => Filter> = {
  paid: () => ({ status: { $in: ['PAID', 'CONFIRMED'] } }),
  processing: () => ({ status: 'PROCESSING' }),
  packed: () => ({ status: 'PACKED', fulfilmentStatus: 'PACKED' }),
  'ready-to-ship': () => ({ status: 'PACKED', fulfilmentStatus: 'READY_TO_SHIP' }),
  shipped: () => ({ status: 'SHIPPED' }),
  delivered: () => ({ status: 'DELIVERED' }),
  cancelled: () => ({ status: 'CANCELLED' }),
  returns: () => ({
    status: {
      $in: ['RETURN_REQUESTED', 'RETURNED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'],
    },
  }),
};

export const shipmentSearchFields = [
  'orderNumber',
  'awb',
  'customerName',
  'customerPhone',
  'courierName',
  'providerOrderId',
  'providerShipmentId',
];
export const orderSearchFields = [
  'number',
  'customer.name',
  'customer.email',
  'customer.phone',
  'providerPaymentId',
  'providerOrderId',
  'shipment.awb',
  'shipment.providerOrderId',
  'shipment.providerShipmentId',
];

/** Counts for every shipments queue, plus deliveries today, in parallel. */
export async function shipmentSummary() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const entries = Object.entries(shipmentViews);
  const [counts, deliveredToday] = await Promise.all([
    Promise.all(entries.map(([, view]) => Shipment.countDocuments(view.filter()))),
    Shipment.countDocuments({ status: 'DELIVERED', deliveredAt: { $gte: startOfDay } }),
  ]);
  return {
    views: entries.map(([key, view], index) => ({ key, label: view.label, count: counts[index] })),
    deliveredToday,
  };
}
