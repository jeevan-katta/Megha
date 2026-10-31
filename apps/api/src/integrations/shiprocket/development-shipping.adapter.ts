import { randomUUID } from 'node:crypto';
import type { ShippingProvider } from './shipping.interface';

const short = () => randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();

/**
 * Stand-in for Shiprocket. Development is local-only; hosted demo mode is guarded by test
 * Razorpay credentials in config. No courier is contacted and tracking is never invented.
 */
export class DevelopmentShippingProvider implements ShippingProvider {
  constructor(readonly name: 'development' | 'demo' = 'development') {}
  private get prefix() {
    return this.name === 'demo' ? 'DEMO' : 'DEV';
  }
  private get displayName() {
    return this.name === 'demo' ? 'Demo' : 'Development';
  }
  async deliveryOptions() {
    return [
      {
        service: 'standard' as const,
        label: this.name === 'demo' ? 'Demo Standard Delivery (no dispatch)' : 'Standard Delivery',
        amount: 12000,
        etaDays: 5,
        courierId: 1,
      },
      {
        service: 'express' as const,
        label: this.name === 'demo' ? 'Demo Express Delivery (no dispatch)' : 'Express Delivery',
        amount: 24000,
        etaDays: 2,
        courierId: 2,
      },
    ];
  }
  async createOrder() {
    return {
      providerOrderId: this.prefix + '-SO-' + short(),
      providerShipmentId: this.prefix + '-SH-' + short(),
    };
  }
  async couriers() {
    return [
      {
        courierId: 1,
        name: this.displayName + ' Surface',
        rate: 12000,
        etaDays: 5,
        etd: null,
        mode: 'surface' as const,
        recommended: true,
      },
      {
        courierId: 2,
        name: this.displayName + ' Air',
        rate: 24000,
        etaDays: 2,
        etd: null,
        mode: 'air' as const,
        recommended: false,
      },
    ];
  }
  async assignAwb(_shipmentId: string, courierId = 1) {
    return {
      awb: this.prefix + 'AWB' + short(),
      courierId,
      courierName: this.displayName + (courierId === 2 ? ' Air' : ' Surface'),
    };
  }
  async generateLabel(providerShipmentId: string) {
    return { labelUrl: '/api/v1/shipping-labels/' + this.name + '/' + providerShipmentId };
  }
  async schedulePickup() {
    const tomorrow = new Date(Date.now() + 24 * 3600000);
    tomorrow.setHours(11, 0, 0, 0);
    return { scheduledFor: tomorrow, reference: this.prefix + '-PICKUP-' + short() };
  }
  async cancel() {}
  async track() {
    return { updates: [], expectedDelivery: null, trackUrl: null };
  }
}
