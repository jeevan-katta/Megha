import type { ClientSession } from 'mongoose';
import { Order } from '../orders/order.model';
import type { Shipment } from './shipment.model';

type ShipmentDoc = InstanceType<typeof Shipment>;

export function labelStatus(shipment: Pick<ShipmentDoc, 'labelUrl' | 'labelPrinted'>) {
  return shipment.labelPrinted ? 'PRINTED' : shipment.labelUrl ? 'GENERATED' : 'NONE';
}

/** Keeps the order's shipment summary (used by lists, filters and search) in step. */
export async function syncOrderSummary(shipment: ShipmentDoc, session?: ClientSession) {
  await Order.updateOne(
    { _id: shipment.orderId },
    {
      $set: {
        shipment: {
          id: String(shipment._id),
          status: shipment.status,
          awb: shipment.awb ?? undefined,
          courierName: shipment.courierName ?? undefined,
          labelStatus: labelStatus(shipment),
          pickupStatus: shipment.pickupStatus,
          providerOrderId: shipment.providerOrderId ?? undefined,
          providerShipmentId: shipment.providerShipmentId ?? undefined,
          expectedDeliveryAt: shipment.expectedDeliveryAt ?? undefined,
          lastUpdateAt: shipment.lastEvent?.at ?? shipment.updatedAt ?? new Date(),
          lastLocation: shipment.lastEvent?.location ?? undefined,
        },
      },
    },
    { session },
  );
}
