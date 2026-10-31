import { pincodeSchema, quoteSchema, shippingRateSchema } from '@megha/validation';
import { Router } from 'express';
import { DomainError } from '../../shared/errors/domain-error';
import { lookupPincode } from '../pincodes/pincode.service';
import { deliveryOptions, quoteCart } from './checkout.service';
export const checkoutRoutes = Router();
checkoutRoutes.post('/validate', async (req, res) => {
  const { items, pincode, shippingService } = quoteSchema.parse(req.body);
  res.json({ data: await quoteCart(items, pincode, shippingService) });
});
checkoutRoutes.post('/shipping-rates', async (req, res) => {
  const { pincode, items } = shippingRateSchema.parse(req.body);
  res.json({ data: await deliveryOptions(pincode, items) });
});
/** City and state for a PIN code, to fill in address forms. */
checkoutRoutes.get('/pincode/:pincode', async (req, res) => {
  const pincode = pincodeSchema.parse(req.params.pincode);
  const details = await lookupPincode(pincode);
  if (details === null)
    throw new DomainError(
      'PINCODE_NOT_FOUND',
      "We couldn't find this PIN code. Please check it.",
      404,
    );
  if (!details)
    throw new DomainError(
      'PINCODE_LOOKUP_UNAVAILABLE',
      'PIN code details are unavailable right now. Please enter the city and state.',
      503,
    );
  res.json({ data: details });
});
