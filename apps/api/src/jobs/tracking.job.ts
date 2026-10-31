import { Shipment } from '../modules/shipments/shipment.model';
import { syncTracking } from '../modules/shipments/fulfilment.service';

/** Statuses where the courier can still report progress. Terminal states are never polled. */
const trackable = [
  'AWB_GENERATED',
  'LABEL_GENERATED',
  'LABEL_PRINTED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERY_EXCEPTION',
  'NDR',
  'RTO_INITIATED',
  'RTO_IN_TRANSIT',
];
/** Webhooks are the primary feed; a shipment is polled only if nothing arrived for this long. */
export const TRACKING_STALE_MS = 3 * 3600000;

/**
 * Backstop for missed courier webhooks: pulls tracking for the stalest active shipments through
 * the same deduplicated pipeline. Bounded per run and claims each shipment before calling the
 * provider, so overlapping runs or a failing AWB cannot hammer the courier API.
 */
export async function reconcileTracking({ limit = 25, staleMs = TRACKING_STALE_MS } = {}) {
  const cutoff = new Date(Date.now() - staleMs);
  const due = await Shipment.find(
    {
      active: true,
      awb: { $type: 'string' },
      status: { $in: trackable },
      $or: [{ syncedAt: { $exists: false } }, { syncedAt: null }, { syncedAt: { $lt: cutoff } }],
    },
    { orderId: 1, syncedAt: 1 },
  )
    .sort({ syncedAt: 1 })
    .limit(limit)
    .lean();
  let synced = 0,
    applied = 0,
    failed = 0;
  for (const shipment of due) {
    const claimed = await Shipment.updateOne(
      { _id: shipment._id, syncedAt: shipment.syncedAt ?? null },
      { $set: { syncedAt: new Date() } },
    );
    if (!claimed.modifiedCount) continue;
    try {
      applied += (await syncTracking(String(shipment.orderId))).applied;
      synced++;
    } catch (error) {
      // Saved on the shipment as lastError by the provider step; staff see it on the order.
      failed++;
      console.error('Tracking reconciliation failed for order', shipment.orderId, error);
    }
  }
  return { due: due.length, synced, applied, failed };
}
