import type { Order } from '@megha/types';

/** Plain-language labels for customers; internal codes never appear on screen. */
export const orderStatusText: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Confirmed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Being prepared',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return requested',
  RETURNED: 'Returned',
  REFUND_PENDING: 'Refund in progress',
  PARTIALLY_REFUNDED: 'Partially refunded',
  REFUNDED: 'Refunded',
};
export const paymentStatusText: Record<string, string> = {
  PENDING: 'Awaiting payment',
  CREATED: 'Awaiting payment',
  AUTHORIZED: 'Processing',
  CAPTURED: 'Paid',
  FAILED: 'Payment failed',
  REFUND_PENDING: 'Refund in progress',
  PARTIALLY_REFUNDED: 'Partially refunded',
  REFUNDED: 'Refunded',
  REFUND_REQUIRED: 'Refund in progress',
};
/** Delivery wording. Before the courier has the parcel customers see "Preparing for shipment". */
export function deliveryText(order: Order) {
  const status = order.shipment?.status;
  if (order.status === 'CANCELLED') return 'Cancelled';
  if (
    !status ||
    [
      'NOT_CREATED',
      'CREATED',
      'COURIER_ASSIGNED',
      'AWB_GENERATED',
      'LABEL_GENERATED',
      'LABEL_PRINTED',
      'PICKUP_SCHEDULED',
      'CANCELLED',
    ].includes(status)
  )
    return ['PENDING_PAYMENT'].includes(order.status) ? 'Not started' : 'Preparing for shipment';
  return (
    (
      {
        PICKED_UP: 'Picked up',
        IN_TRANSIT: 'In transit',
        OUT_FOR_DELIVERY: 'Out for delivery',
        DELIVERED: 'Delivered',
        DELIVERY_EXCEPTION: 'Delivery delayed',
        NDR: 'Delivery attempt failed',
        RTO_INITIATED: 'Returning to seller',
        RTO_IN_TRANSIT: 'Returning to seller',
        RTO_DELIVERED: 'Returned to seller',
      } as Record<string, string>
    )[status] ?? 'In transit'
  );
}

export const trackingStages = [
  'Order Confirmed',
  'Packed',
  'Picked Up',
  'In Transit',
  'Out for Delivery',
  'Delivered',
] as const;
/** How many tracking stages are complete (0–6). */
export function stagesDone(order: Order) {
  if (['PENDING_PAYMENT', 'CANCELLED'].includes(order.status)) return 0;
  const shipment = order.shipment?.status ?? '';
  if (shipment === 'DELIVERED' || order.status === 'DELIVERED') return 6;
  if (shipment === 'OUT_FOR_DELIVERY') return 5;
  if (['IN_TRANSIT', 'NDR', 'DELIVERY_EXCEPTION'].includes(shipment)) return 4;
  if (order.shipment?.pickedUpAt || shipment === 'PICKED_UP') return 3;
  if (['PACKED', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED'].includes(order.fulfilmentStatus ?? ''))
    return 2;
  return 1;
}
