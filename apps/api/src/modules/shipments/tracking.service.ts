import { shipmentInCourierHands, type ShipmentStatus } from '@megha/constants';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import type { TrackingUpdate } from '../../integrations/shiprocket/shipping.interface';
import { notifyOnce } from '../notifications/notification.service';
import { Order } from '../orders/order.model';
import { Shipment, ShipmentEvent } from './shipment.model';
import { syncOrderSummary } from './shipment-summary';

type Normalized = ShipmentStatus | 'PICKUP_EXCEPTION' | null;

/** Maps a courier's raw status text to Megha's shipment status. Unknown text returns null. */
export function normalizeStatus(raw: string): Normalized {
  const text = raw
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim();
  const has = (...words: string[]) => words.some((word) => text.includes(word));
  if (/\bRTO\b/.test(text) || has('RETURN TO ORIGIN')) {
    if (has('DELIVERED')) return 'RTO_DELIVERED';
    if (has('TRANSIT', 'OUT FOR DELIVERY', 'OFD')) return 'RTO_IN_TRANSIT';
    return 'RTO_INITIATED';
  }
  if (has('PICKUP EXCEPTION', 'PICKUP ERROR', 'PICKUP FAILED')) return 'PICKUP_EXCEPTION';
  if (has('UNDELIVERED', 'NDR', 'DELIVERY FAILED', 'FAILED DELIVERY', 'DELIVERY ATTEMPTED'))
    return 'NDR';
  if (has('OUT FOR DELIVERY')) return 'OUT_FOR_DELIVERY';
  if (has('DELIVERED')) return 'DELIVERED';
  if (has('CANCEL')) return 'CANCELLED';
  if (has('LOST', 'DAMAGED', 'DESTROYED', 'EXCEPTION', 'DELAYED', 'MISROUTED', 'DISPOSED'))
    return 'DELIVERY_EXCEPTION';
  if (has('PICKED UP', 'PICKUP DONE', 'PICKUP COMPLETE')) return 'PICKED_UP';
  if (has('IN TRANSIT', 'SHIPPED', 'DISPATCHED', 'REACHED', 'CONNECTED', 'RECEIVED AT'))
    return 'IN_TRANSIT';
  if (
    has(
      'OUT FOR PICKUP',
      'PICKUP SCHEDULED',
      'PICKUP GENERATED',
      'PICKUP QUEUED',
      'PICKUP RESCHEDULED',
    )
  )
    return 'PICKUP_SCHEDULED';
  return null;
}

const rank: Partial<Record<ShipmentStatus, number>> = {
  NOT_CREATED: 0,
  CREATED: 1,
  COURIER_ASSIGNED: 2,
  AWB_GENERATED: 3,
  LABEL_GENERATED: 4,
  LABEL_PRINTED: 5,
  PICKUP_SCHEDULED: 6,
  PICKED_UP: 7,
  IN_TRANSIT: 8,
  DELIVERY_EXCEPTION: 8,
  NDR: 8,
  OUT_FOR_DELIVERY: 9,
  DELIVERED: 10,
  RTO_INITIATED: 11,
  RTO_IN_TRANSIT: 12,
  RTO_DELIVERED: 13,
};
const terminal: ShipmentStatus[] = ['DELIVERED', 'RTO_DELIVERED', 'CANCELLED'];

/** Statuses only move forward, so late or repeated scans can never undo progress. */
function shouldApply(current: ShipmentStatus, next: ShipmentStatus) {
  if (current === next || terminal.includes(current)) return false;
  if (next === 'CANCELLED') return !shipmentInCourierHands.includes(current);
  return (rank[next] ?? -1) >= (rank[current] ?? 0);
}

const customerMessages: Partial<Record<ShipmentStatus, [string, string]>> = {
  PICKED_UP: ['Order shipped', 'Your order has been picked up by the courier.'],
  OUT_FOR_DELIVERY: ['Out for delivery', 'Your order is out for delivery today.'],
  DELIVERED: ['Order delivered', 'Your order has been delivered.'],
  NDR: [
    'Delivery attempt failed',
    'The courier could not deliver your order. We will contact you.',
  ],
  DELIVERY_EXCEPTION: ['Delivery delayed', 'There is an issue with your delivery. We are on it.'],
};

/**
 * Applies courier scans to a shipment. Every scan is stored once as a ShipmentEvent; status,
 * order state and customer notifications follow. Safe to call repeatedly with the same scans.
 */
export async function applyTracking(
  shipmentId: string,
  updates: TrackingUpdate[],
  source: 'webhook' | 'sync',
  extra: { expectedDelivery?: Date | null; trackUrl?: string | null } = {},
) {
  const session = await mongoose.startSession();
  let applied = 0;
  try {
    await session.withTransaction(async () => {
      applied = 0;
      const shipment = await Shipment.findById(shipmentId).session(session);
      if (!shipment) return;
      const order = await Order.findById(shipment.orderId).session(session);
      if (!order) return;
      if (extra.expectedDelivery) shipment.expectedDeliveryAt = extra.expectedDelivery;
      if (extra.trackUrl) shipment.trackUrl = extra.trackUrl;
      const milestones: ShipmentStatus[] = [];
      for (const update of [...updates].sort((a, b) => a.at.getTime() - b.at.getTime())) {
        const normalized = normalizeStatus(update.providerStatus);
        const fingerprint = createHash('sha256')
          .update(
            [
              shipment.awb ?? shipmentId,
              update.providerStatus,
              update.activity,
              update.location,
              update.at.toISOString(),
            ].join('|'),
          )
          .digest('hex');
        const existing = await ShipmentEvent.exists({ fingerprint }).session(session);
        if (existing) continue;
        await ShipmentEvent.create(
          [
            {
              shipmentId,
              orderId: shipment.orderId,
              awb: shipment.awb,
              providerStatus: update.providerStatus.slice(0, 120),
              normalizedStatus: normalized ?? undefined,
              activity: update.activity.slice(0, 500),
              location: update.location.slice(0, 200),
              at: update.at,
              source,
              fingerprint,
            },
          ],
          { session },
        );
        applied++;
        if (!shipment.lastEvent?.at || update.at >= shipment.lastEvent.at)
          shipment.lastEvent = {
            status:
              normalized && normalized !== 'PICKUP_EXCEPTION' ? normalized : update.providerStatus,
            activity: update.activity,
            location: update.location,
            at: update.at,
          };
        if (normalized === 'PICKUP_EXCEPTION') {
          shipment.pickupStatus = 'FAILED';
          shipment.lastError = {
            step: 'pickup',
            message: update.activity || update.providerStatus,
            at: update.at,
          };
          continue;
        }
        if (!normalized || !shouldApply(shipment.status as ShipmentStatus, normalized)) continue;
        shipment.status = normalized;
        milestones.push(normalized);
        if (shipmentInCourierHands.includes(normalized) && !shipment.pickedUpAt) {
          shipment.pickedUpAt = update.at;
          shipment.pickupStatus = 'PICKED_UP';
        }
        if (normalized === 'DELIVERED') shipment.deliveredAt = update.at;
        // Nested fields are set by path; spreading a subdocument would copy Mongoose internals.
        if (normalized === 'NDR')
          shipment.set({
            'ndr.reason': update.activity || update.providerStatus,
            'ndr.attempts': (shipment.ndr?.attempts ?? 0) + 1,
            'ndr.lastAttemptAt': update.at,
          });
        if (normalized === 'RTO_INITIATED' && !shipment.rto?.initiatedAt)
          shipment.set('rto.initiatedAt', update.at);
        if (normalized === 'RTO_DELIVERED') shipment.set('rto.deliveredAt', update.at);
        // Order state follows real courier milestones only.
        if (
          shipmentInCourierHands.includes(normalized) &&
          ['PAID', 'CONFIRMED', 'PROCESSING', 'PACKED'].includes(order.status!)
        ) {
          order.status = 'SHIPPED';
          order.fulfilmentStatus = 'SHIPPED';
          order.history.push({
            status: 'SHIPPED',
            at: update.at,
            actor: 'system',
            description: 'Picked up by ' + (shipment.courierName || 'courier'),
          });
        }
        if (normalized === 'DELIVERED' && order.status === 'SHIPPED') {
          order.status = 'DELIVERED';
          order.fulfilmentStatus = 'DELIVERED';
          order.deliveredAt = update.at;
          order.history.push({
            status: 'DELIVERED',
            at: update.at,
            actor: 'system',
            description: 'Delivered' + (update.location ? ' · ' + update.location : ''),
          });
        }
        if (normalized === 'RTO_DELIVERED' && order.status === 'SHIPPED') {
          order.status = 'RETURNED';
          order.fulfilmentStatus = 'RETURNED';
          order.history.push({
            status: 'RETURNED',
            at: update.at,
            actor: 'system',
            description: 'Returned to origin; awaiting inspection',
          });
        }
        if (normalized === 'CANCELLED' && order.fulfilmentStatus === 'READY_TO_SHIP') {
          order.fulfilmentStatus = 'PACKED';
          shipment.cancelledAt = update.at;
        }
        if (['OUT_FOR_DELIVERY', 'NDR', 'DELIVERY_EXCEPTION', 'RTO_INITIATED'].includes(normalized))
          order.history.push({
            status: normalized,
            at: update.at,
            actor: 'system',
            description: update.activity || update.providerStatus,
          });
      }
      shipment.syncedAt = new Date();
      await shipment.save({ session });
      await order.save({ session });
      await syncOrderSummary(shipment, session);
      for (const milestone of milestones) {
        const message = customerMessages[milestone];
        if (message)
          await notifyOnce(
            String(order.userId),
            'order:' +
              order.number +
              ':' +
              milestone +
              (milestone === 'NDR' ? ':' + (shipment.ndr?.attempts ?? 1) : ''),
            message[0] + ' · ' + order.number,
            message[1],
            { orderId: String(order._id) },
            session,
          );
      }
    });
  } finally {
    await session.endSession();
  }
  return applied;
}
