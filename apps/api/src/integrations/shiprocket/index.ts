import { config } from '../../config';
import { DomainError } from '../../shared/errors/domain-error';
import { DevelopmentShippingProvider } from './development-shipping.adapter';
import { ShiprocketProvider } from './shiprocket.provider';
import type { ShippingProvider } from './shipping.interface';

const unavailable = (): never => {
  throw new DomainError(
    'SHIPPING_UNAVAILABLE',
    'Shipping is not configured. Contact sales for a quotation.',
    503,
  );
};
const unconfigured: ShippingProvider = {
  name: 'shiprocket',
  deliveryOptions: async () => unavailable(),
  createOrder: async () => unavailable(),
  couriers: async () => unavailable(),
  assignAwb: async () => unavailable(),
  generateLabel: async () => unavailable(),
  schedulePickup: async () => unavailable(),
  cancel: async () => unavailable(),
  track: async () => unavailable(),
};
export const shipping: ShippingProvider =
  config.shipping === 'shiprocket'
    ? new ShiprocketProvider()
    : config.shipping === 'development' || config.shipping === 'demo'
      ? new DevelopmentShippingProvider(config.shipping)
      : unconfigured;
