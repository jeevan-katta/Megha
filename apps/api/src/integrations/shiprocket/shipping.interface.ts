/** Customer-facing delivery choice. Courier names stay internal. */
export interface DeliveryOption {
  service: 'standard' | 'express';
  label: string;
  /** Paise. */
  amount: number;
  etaDays: number | null;
  courierId?: number;
}
/** A courier the warehouse can choose for a created shipment. */
export interface CourierOption {
  courierId: number;
  name: string;
  /** Paise. */
  rate: number;
  etaDays: number | null;
  etd: string | null;
  mode: 'air' | 'surface';
  recommended: boolean;
}
export interface Parcel {
  /** Kilograms. */
  weight: number;
  /** Centimetres. */
  length: number;
  breadth: number;
  height: number;
}
export interface ProviderAddress {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}
export interface ProviderOrderInput {
  orderNumber: string;
  orderDate: Date;
  shipping: ProviderAddress;
  billing: ProviderAddress;
  items: { name: string; sku: string; units: number; unitPrice: number; gstRate: number }[];
  /** Paise. */
  subTotal: number;
  parcel: Parcel;
}
/** One courier scan, as reported by the provider. */
export interface TrackingUpdate {
  providerStatus: string;
  activity: string;
  location: string;
  at: Date;
}
export interface ShippingProvider {
  readonly name: 'shiprocket' | 'development' | 'demo';
  deliveryOptions(
    deliveryPincode: string,
    parcel: { weight: number; declaredValue: number },
  ): Promise<DeliveryOption[]>;
  createOrder(
    input: ProviderOrderInput,
  ): Promise<{ providerOrderId: string; providerShipmentId: string }>;
  couriers(providerShipmentId: string, providerOrderId: string): Promise<CourierOption[]>;
  assignAwb(
    providerShipmentId: string,
    courierId?: number,
  ): Promise<{ awb: string; courierId: number; courierName: string }>;
  generateLabel(providerShipmentId: string): Promise<{ labelUrl: string }>;
  schedulePickup(
    providerShipmentId: string,
  ): Promise<{ scheduledFor: Date | null; reference: string | null }>;
  cancel(providerOrderId: string): Promise<void>;
  track(awb: string): Promise<{
    updates: TrackingUpdate[];
    expectedDelivery: Date | null;
    trackUrl: string | null;
  }>;
}
