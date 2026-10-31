export const roles = [
  'SUPER_ADMIN',
  'ADMIN',
  'SALES',
  'INVENTORY_MANAGER',
  'SERVICE_MANAGER',
  'TECHNICIAN',
  'CUSTOMER',
] as const;
export type Role = (typeof roles)[number];
export const permissions: Record<string, readonly string[]> = {
  SALES: ['customers', 'enquiries', 'orders', 'find-my-spare'],
  INVENTORY_MANAGER: [
    'products',
    'categories',
    'machines',
    'machine-models',
    'compatibility',
    'inventory',
    'orders',
    'shipments',
  ],
  SERVICE_MANAGER: ['service-requests', 'technicians', 'service-visits', 'find-my-spare'],
  TECHNICIAN: ['service-requests', 'service-visits'],
};
export function permitted(role: string, module: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN'].includes(role) || !!permissions[role]?.includes(module);
}
export const publicRequestKinds = ['enquiries', 'service-requests', 'find-my-spare'] as const;
export const personalRecordKinds = [
  ...publicRequestKinds,
  'addresses',
  'registered-machines',
  'saved',
  'notifications',
] as const;
export const writablePersonalKinds = ['addresses', 'registered-machines', 'saved'] as const;
export const transitions: Record<string, Record<string, readonly string[]>> = {
  // Staff move an order only through processing and packing. Shipped, delivered and RTO come
  // from courier tracking; cancellations, returns and refunds have their own services.
  orders: {
    PAID: ['PROCESSING'],
    CONFIRMED: ['PROCESSING'],
    PROCESSING: ['PACKED'],
  },
  'service-requests': {
    NEW: ['TRIAGED', 'CANCELLED'],
    TRIAGED: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['SCHEDULED'],
    SCHEDULED: ['IN_PROGRESS'],
    IN_PROGRESS: ['WAITING_FOR_PARTS', 'WAITING_FOR_CUSTOMER', 'COMPLETED'],
    WAITING_FOR_PARTS: ['IN_PROGRESS'],
    WAITING_FOR_CUSTOMER: ['IN_PROGRESS'],
    COMPLETED: ['CLOSED'],
  },
  'find-my-spare': {
    NEW: ['ASSIGNED'],
    ASSIGNED: ['REVIEWING'],
    REVIEWING: ['NEED_MORE_INFO', 'IDENTIFIED', 'CLOSED'],
    NEED_MORE_INFO: ['REVIEWING'],
    IDENTIFIED: ['RESOLVED'],
    RESOLVED: ['CLOSED'],
  },
  // Enquiries and quotations share one workflow: a request can move on to a priced quotation.
  enquiries: {
    NEW: ['CONTACTED', 'CLOSED'],
    CONTACTED: ['QUOTE_PREPARED', 'LOST', 'CLOSED'],
    QUOTE_PREPARED: ['QUOTE_SENT'],
    QUOTE_SENT: ['NEGOTIATION', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
    NEGOTIATION: ['QUOTE_PREPARED', 'ACCEPTED', 'REJECTED', 'LOST'],
    ACCEPTED: ['CONVERTED'],
  },
};

/** Order lifecycle. Shipment, payment and fulfilment progress are tracked separately. */
export const orderStatuses = [
  'PENDING_PAYMENT',
  'PAID',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
  'REFUND_PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;
export const paymentStatuses = [
  'CREATED',
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUND_PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;
export const fulfilmentStatuses = [
  'UNFULFILLED',
  'PICKING',
  'PACKED',
  'READY_TO_SHIP',
  'SHIPPED',
  'DELIVERED',
  'RETURNED',
] as const;
export const shipmentStatuses = [
  'NOT_CREATED',
  'CREATED',
  'COURIER_ASSIGNED',
  'AWB_GENERATED',
  'LABEL_GENERATED',
  'LABEL_PRINTED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_EXCEPTION',
  'NDR',
  'RTO_INITIATED',
  'RTO_IN_TRANSIT',
  'RTO_DELIVERED',
  'CANCELLED',
] as const;
export type ShipmentStatus = (typeof shipmentStatuses)[number];
/** The courier has the parcel from this status on; the order counts as shipped. */
export const shipmentInCourierHands: readonly ShipmentStatus[] = [
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_EXCEPTION',
  'NDR',
  'RTO_INITIATED',
  'RTO_IN_TRANSIT',
  'RTO_DELIVERED',
];
export const returnStatuses = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'RECEIVED',
  'COMPLETED',
] as const;
export const refundStatuses = ['PENDING', 'PROCESSED', 'FAILED'] as const;

/** States and union territories, as used on shipping addresses and by India Post. */
export const indianStates = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;
