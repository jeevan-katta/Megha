import { z } from 'zod';
import { DomainError } from '../../shared/errors/domain-error';
import type {
  CourierOption,
  DeliveryOption,
  ProviderAddress,
  ProviderOrderInput,
  ShippingProvider,
  TrackingUpdate,
} from './shipping.interface';

const base = 'https://apiv2.shiprocket.in/v1/external/';
/** Shiprocket tokens last ten days; refresh well before that. */
const TOKEN_TTL_MS = 9 * 24 * 3600000;
let token: { value: string; expires: number } | null = null;

const rupeesToPaise = (value: unknown) => Math.round(Number(value) * 100);
const paiseToRupees = (value: number) => Math.round(value) / 100;

function providerError(step: string, body: unknown, status: number): DomainError {
  // Keep only the provider's human message; never echo raw payloads or credentials.
  const message =
    typeof body === 'object' && body && 'message' in body
      ? String((body as { message: unknown }).message).slice(0, 300)
      : 'HTTP ' + status;
  return new DomainError(
    'SHIPPING_PROVIDER_ERROR',
    'Shiprocket ' + step + ' failed: ' + message,
    502,
  );
}

async function login(): Promise<string> {
  if (token && token.expires > Date.now()) return token.value;
  const response = await fetch(base + 'auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.token) throw providerError('login', body, response.status);
  token = { value: String(body.token), expires: Date.now() + TOKEN_TTL_MS };
  return token.value;
}

async function call<T>(step: string, path: string, body?: unknown, retried = false): Promise<T> {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + (await login()), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401 && !retried) {
    token = null;
    return call(step, path, body, true);
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) throw providerError(step, json, response.status);
  return json as T;
}

const courierSchema = z.object({
  courier_company_id: z.coerce.number(),
  courier_name: z.string(),
  rate: z.coerce.number(),
  estimated_delivery_days: z.coerce.number().nullable().optional(),
  etd: z.string().nullable().optional(),
  is_surface: z.boolean().optional(),
});
const serviceabilitySchema = z.object({
  data: z
    .object({
      available_courier_companies: z.array(courierSchema).default([]),
      recommended_courier_company_id: z.coerce.number().nullable().optional(),
    })
    .optional(),
});

function toCourierOptions(body: unknown): CourierOption[] {
  const data = serviceabilitySchema.parse(body).data;
  const recommended = data?.recommended_courier_company_id ?? null;
  return (data?.available_courier_companies ?? []).map((courier) => ({
    courierId: courier.courier_company_id,
    name: courier.courier_name,
    rate: rupeesToPaise(courier.rate),
    etaDays: courier.estimated_delivery_days ?? null,
    etd: courier.etd ?? null,
    mode: courier.is_surface === false ? 'air' : 'surface',
    recommended: courier.courier_company_id === recommended,
  }));
}

function splitName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return { first, last: rest.join(' ') };
}
function addressFields(prefix: 'billing' | 'shipping', address: ProviderAddress) {
  const name = splitName(address.name);
  return {
    [prefix + '_customer_name']: name.first,
    [prefix + '_last_name']: name.last,
    [prefix + '_address']: address.line1,
    [prefix + '_address_2']: address.line2 ?? '',
    [prefix + '_city']: address.city,
    [prefix + '_pincode']: address.pincode,
    [prefix + '_state']: address.state,
    [prefix + '_country']: 'India',
    [prefix + '_email']: address.email,
    [prefix + '_phone']: address.phone.replace(/\D/g, '').slice(-10),
  };
}
const pad = (value: number) => String(value).padStart(2, '0');
const shiprocketDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Shiprocket timestamps are IST wall-clock strings such as "2026-10-09 14:05:00". */
export function parseShiprocketDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (match) {
    const [, y, m, d, h, min, s = '00'] = match;
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}+05:30`);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export class ShiprocketProvider implements ShippingProvider {
  readonly name = 'shiprocket' as const;

  async deliveryOptions(
    deliveryPincode: string,
    parcel: { weight: number; declaredValue: number },
  ) {
    const params = new URLSearchParams({
      pickup_postcode: process.env.SHIPROCKET_PICKUP_PINCODE ?? '',
      delivery_postcode: deliveryPincode,
      weight: String(parcel.weight),
      cod: '0',
      declared_value: String(paiseToRupees(parcel.declaredValue)),
    });
    const couriers = toCourierOptions(
      await call('serviceability', 'courier/serviceability/?' + params),
    );
    if (!couriers.length) return [];
    const byPrice = [...couriers].sort((a, b) => a.rate - b.rate);
    const standard = byPrice[0];
    const options: DeliveryOption[] = [
      {
        service: 'standard',
        label: 'Standard Delivery',
        amount: standard.rate,
        etaDays: standard.etaDays,
        courierId: standard.courierId,
      },
    ];
    const fastest = couriers
      .filter((courier) => courier.etaDays !== null)
      .sort((a, b) => a.etaDays! - b.etaDays! || a.rate - b.rate)[0];
    if (fastest && standard.etaDays !== null && fastest.etaDays! < standard.etaDays)
      options.push({
        service: 'express',
        label: 'Express Delivery',
        amount: fastest.rate,
        etaDays: fastest.etaDays,
        courierId: fastest.courierId,
      });
    return options;
  }

  async createOrder(input: ProviderOrderInput) {
    const same = JSON.stringify({ ...input.shipping }) === JSON.stringify({ ...input.billing });
    const body = await call<{ order_id?: unknown; shipment_id?: unknown; message?: string }>(
      'shipment creation',
      'orders/create/adhoc',
      {
        order_id: input.orderNumber,
        order_date: shiprocketDate(input.orderDate),
        pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION,
        ...addressFields('billing', input.billing),
        shipping_is_billing: same,
        ...(same ? {} : addressFields('shipping', input.shipping)),
        order_items: input.items.map((item) => ({
          name: item.name,
          sku: item.sku,
          units: item.units,
          selling_price: paiseToRupees(item.unitPrice),
          discount: 0,
          tax: item.gstRate,
        })),
        payment_method: 'Prepaid',
        sub_total: paiseToRupees(input.subTotal),
        length: input.parcel.length,
        breadth: input.parcel.breadth,
        height: input.parcel.height,
        weight: input.parcel.weight,
      },
    );
    if (!body.order_id || !body.shipment_id) throw providerError('shipment creation', body, 200);
    return { providerOrderId: String(body.order_id), providerShipmentId: String(body.shipment_id) };
  }

  async couriers(_providerShipmentId: string, providerOrderId: string) {
    return toCourierOptions(
      await call(
        'courier list',
        'courier/serviceability/?' + new URLSearchParams({ order_id: providerOrderId }),
      ),
    );
  }

  async assignAwb(providerShipmentId: string, courierId?: number) {
    const body = await call<{
      awb_assign_status?: number;
      response?: {
        data?: {
          awb_code?: string;
          courier_company_id?: unknown;
          courier_name?: string;
          awb_assign_error?: string;
        };
      };
      message?: string;
    }>('AWB generation', 'courier/assign/awb', {
      shipment_id: providerShipmentId,
      ...(courierId ? { courier_id: courierId } : {}),
    });
    const data = body.response?.data;
    if (body.awb_assign_status !== 1 || !data?.awb_code)
      throw providerError(
        'AWB generation',
        { message: data?.awb_assign_error ?? body.message },
        200,
      );
    return {
      awb: data.awb_code,
      courierId: Number(data.courier_company_id),
      courierName: data.courier_name ?? '',
    };
  }

  async generateLabel(providerShipmentId: string) {
    const body = await call<{ label_created?: number; label_url?: string; response?: string }>(
      'label generation',
      'courier/generate/label',
      { shipment_id: [providerShipmentId] },
    );
    if (body.label_created !== 1 || !body.label_url)
      throw providerError('label generation', { message: body.response }, 200);
    return { labelUrl: body.label_url };
  }

  async schedulePickup(providerShipmentId: string) {
    const body = await call<{
      pickup_status?: number;
      response?: { pickup_scheduled_date?: string; pickup_token_number?: string; data?: string };
      message?: string;
    }>('pickup scheduling', 'courier/generate/pickup', { shipment_id: [providerShipmentId] });
    if (body.pickup_status !== 1)
      throw providerError(
        'pickup scheduling',
        { message: body.response?.data ?? body.message },
        200,
      );
    return {
      scheduledFor: parseShiprocketDate(body.response?.pickup_scheduled_date),
      reference: body.response?.pickup_token_number ?? null,
    };
  }

  async cancel(providerOrderId: string) {
    await call('cancellation', 'orders/cancel', { ids: [Number(providerOrderId)] });
  }

  async track(awb: string) {
    const body = await call<{
      tracking_data?: {
        shipment_track_activities?: Record<string, unknown>[] | null;
        track_url?: string;
        etd?: string;
      };
    }>('tracking sync', 'courier/track/awb/' + encodeURIComponent(awb));
    const data = body.tracking_data ?? {};
    const updates: TrackingUpdate[] = [];
    for (const scan of data.shipment_track_activities ?? []) {
      const at = parseShiprocketDate(scan.date);
      if (!at) continue;
      updates.push({
        providerStatus: String(scan['sr-status-label'] ?? scan.status ?? ''),
        activity: String(scan.activity ?? ''),
        location: String(scan.location ?? ''),
        at,
      });
    }
    return {
      updates,
      expectedDelivery: parseShiprocketDate(data.etd),
      trackUrl: data.track_url ?? null,
    };
  }
}
