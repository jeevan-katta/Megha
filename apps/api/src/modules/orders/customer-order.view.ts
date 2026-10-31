import { Refund } from '../refunds/refund.model';
import { Return } from '../returns/return.model';
import { Shipment, ShipmentEvent } from '../shipments/shipment.model';
import { Order } from './order.model';

/** Timeline entries customers may see; staff notes and internal steps stay private. */
const customerSteps = new Set([
  'PENDING_PAYMENT',
  'PAYMENT_FAILED',
  'PAID',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'NDR',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURN_APPROVED',
  'RETURN_REJECTED',
  'RETURNED',
  'REFUND_COMPLETED',
]);

/** Everything a customer sees about one order, read only from Megha's own records. */
export async function customerOrderView(filter: { _id?: string; number?: string; userId: string }) {
  const order = await Order.findOne(filter, {
    idempotencyKey: 0,
    requestFingerprint: 0,
    providerOrderId: 0,
    paymentLockUntil: 0,
    'package.packedBy': 0,
  }).lean();
  if (!order) return null;
  const id = String(order._id);
  const [shipment, refunds, returns] = await Promise.all([
    Shipment.findOne({ orderId: id, status: { $ne: 'NOT_CREATED' } })
      .sort({ active: -1, createdAt: -1 })
      .lean(),
    Refund.find({ orderId: id }, { amount: 1, status: 1, createdAt: 1, processedAt: 1 })
      .sort({ createdAt: -1 })
      .lean(),
    Return.find(
      { orderId: id },
      { number: 1, items: 1, reason: 1, status: 1, createdAt: 1, decisionNotes: 1 },
    )
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  const events = shipment
    ? await ShipmentEvent.find(
        { shipmentId: String(shipment._id) },
        { normalizedStatus: 1, activity: 1, location: 1, at: 1 },
      )
        .sort({ at: -1 })
        .limit(100)
        .lean()
    : [];
  // Who cancelled, so the customer sees the right explanation.
  const cancellation = [...order.history].reverse().find((entry) => entry.status === 'CANCELLED');
  const cancelledBy =
    order.status !== 'CANCELLED'
      ? undefined
      : cancellation?.actor === 'customer'
        ? 'customer'
        : /expired/i.test(order.cancelReason ?? cancellation?.description ?? '')
          ? 'expired'
          : 'store';
  return {
    ...order,
    cancelledBy,
    history: order.history
      .filter((entry) => customerSteps.has(entry.status ?? ''))
      .map((entry) => ({ status: entry.status, at: entry.at })),
    shipment: shipment
      ? {
          status: shipment.status,
          courierName: shipment.courierName ?? null,
          awb: shipment.awb ?? null,
          trackUrl: shipment.trackUrl ?? null,
          expectedDeliveryAt: shipment.expectedDeliveryAt ?? null,
          pickedUpAt: shipment.pickedUpAt ?? null,
          deliveredAt: shipment.deliveredAt ?? null,
          lastEvent: shipment.lastEvent?.at
            ? {
                activity: shipment.lastEvent.activity,
                location: shipment.lastEvent.location,
                at: shipment.lastEvent.at,
              }
            : null,
        }
      : null,
    trackingEvents: events.map((event) => ({
      status: event.normalizedStatus ?? null,
      activity: event.activity,
      location: event.location,
      at: event.at,
    })),
    refunds,
    returns,
  };
}
