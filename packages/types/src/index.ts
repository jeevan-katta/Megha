export interface Product {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  partNumber: string;
  category: string;
  image: string;
  description: string;
  price: number;
  gstRate: number;
  stock: number;
  reserved: number;
  threshold: number;
  active: boolean;
  featured: boolean;
  keywords: string[];
  specifications: { label: string; value: string }[];
  developmentOnly: boolean;
}
export interface Machine {
  _id: string;
  name: string;
  slug: string;
  image: string;
  category: string;
  capacity: string;
  description: string;
  specifications: { label: string; value: string }[];
}
export interface Category {
  _id: string;
  name: string;
  slug: string;
  image: string;
}
export interface Service {
  _id: string;
  name: string;
  slug: string;
  image: string;
  description: string;
}
export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  company?: string;
  gstin?: string;
}
export interface CartItem {
  productId: string;
  quantity: number;
}
export interface OrderLine {
  productId: string;
  name: string;
  sku: string;
  partNumber?: string;
  image: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  tax: number;
  total: number;
}
export interface Totals {
  items: OrderLine[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  /** False until a PIN code is supplied and delivery is priced. */
  shippingQuoted?: boolean;
  shippingService?: { service: string; label: string; amount?: number; etaDays?: number | null };
}
export interface DeliveryOption {
  service: 'standard' | 'express';
  label: string;
  amount: number;
  etaDays: number | null;
}
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}
export interface CustomerShipment {
  status: string;
  courierName: string | null;
  awb: string | null;
  trackUrl: string | null;
  expectedDeliveryAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  lastEvent: { activity: string; location: string; at: string } | null;
}
export interface RecordData {
  _id: string;
  kind: string;
  number?: string;
  title?: string;
  name?: string;
  status?: string;
  email?: string;
  phone?: string;
  description?: string;
  createdAt: string;
  data: Record<string, unknown>;
}
export interface Order extends Totals {
  _id: string;
  number: string;
  status: string;
  paymentStatus: string;
  fulfilmentStatus?: string;
  customer: { name: string; email: string; phone: string; company?: string; gstin?: string };
  address: Address;
  billingAddress?: Address;
  history: { status: string; at: string }[];
  /** Present on cancelled orders in the customer view. */
  cancelledBy?: 'customer' | 'expired' | 'store';
  confirmedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  refundedAmount?: number;
  providerPaymentId?: string;
  /** Present on the customer order view. */
  shipment?: CustomerShipment | null;
  trackingEvents?: { status: string | null; activity: string; location: string; at: string }[];
  refunds?: {
    _id: string;
    amount: number;
    status: string;
    createdAt: string;
    processedAt?: string;
  }[];
  returns?: {
    _id: string;
    number: string;
    status: string;
    reason: string;
    createdAt: string;
    decisionNotes?: string;
    items: { productId: string; name: string; quantity: number }[];
  }[];
  createdAt: string;
  paymentProvider: string;
  providerOrderId?: string;
  reservationExpires?: string;
}
export interface Catalogue {
  products: Product[];
  machines: Machine[];
  categories: Category[];
  services: Service[];
}

/** Admin dashboard. Money in paise; dates as ISO strings. */
export type DashboardRange = '7d' | '30d' | '90d' | '12m';
export interface DashboardMetric {
  value: number;
  /** The same measure over the equal-length period just before. */
  previous: number;
}
export interface DashboardAttention {
  key: string;
  label: string;
  count: number;
  tone: 'danger' | 'warning' | 'info';
  href: string;
  /** For example how long the oldest item has waited. */
  since?: string | null;
}
export interface DashboardStage {
  key: string;
  label: string;
  count: number;
  href: string;
}
export interface AdminDashboardData {
  range: { key: DashboardRange; from: string; to: string; bucket: 'day' | 'week' | 'month' };
  generatedAt: string;
  kpis: {
    netSales: DashboardMetric;
    grossSales: DashboardMetric;
    refunds: DashboardMetric;
    orders: DashboardMetric;
    averageOrder: DashboardMetric;
    customers: DashboardMetric;
  };
  trend: { start: string; sales: number; orders: number }[];
  attention: DashboardAttention[];
  pipeline: DashboardStage[];
  recentOrders: {
    _id: string;
    number: string;
    customer: string;
    items: number;
    total: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }[];
  topProducts: { productId: string; name: string; sku: string; quantity: number; sales: number }[];
  inventory: {
    active: number;
    healthy: number;
    low: number;
    out: number;
    stockValue: number;
    lowest: { _id: string; name: string; sku: string; available: number; threshold: number }[];
  };
  requests: {
    enquiries: { open: number; received: number; stages: DashboardStage[] };
    service: { open: number; received: number; stages: DashboardStage[] };
    spares: { open: number; received: number };
  };
  totals: { customers: number; products: number; orders: number };
}
