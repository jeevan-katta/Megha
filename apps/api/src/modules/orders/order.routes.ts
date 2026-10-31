import { checkoutSchema, objectId } from '@megha/validation';
import { Router } from 'express';
import { z } from 'zod';
import { expireCustomerOrders } from '../../jobs/reservations.job';
import { actor, authenticated } from '../../middleware/authenticate.middleware';
import { DomainError } from '../../shared/errors/domain-error';
import { createOrder } from '../checkout/checkout.service';
import { requestReturn } from '../returns/return.service';
import { customerOrderView } from './customer-order.view';
import { cancel } from './order-cancellation.service';
export const orderRoutes = Router();
orderRoutes.use(authenticated);
const orderNumber = z.string().regex(/^[A-Z0-9-]{4,40}$/);
orderRoutes.get('/track/:number', async (req, res) => {
  await expireCustomerOrders(actor(res)._id);
  const order = await customerOrderView({
    number: orderNumber.parse(req.params.number),
    userId: actor(res)._id,
  });
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found.', 404);
  res.json({ data: order });
});
orderRoutes.get('/:id', async (req, res) => {
  await expireCustomerOrders(actor(res)._id);
  const order = await customerOrderView({
    _id: objectId.parse(req.params.id),
    userId: actor(res)._id,
  });
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found.', 404);
  res.json({ data: order });
});
orderRoutes.post('/', async (req, res) => {
  res.status(201).json({ data: await createOrder(actor(res)._id, checkoutSchema.parse(req.body)) });
});
orderRoutes.post('/:id/cancel', async (req, res) => {
  await cancel(objectId.parse(req.params.id), actor(res)._id, false, {
    reason: 'Cancelled by customer before payment',
  });
  res.json({ data: { ok: true } });
});
orderRoutes.post('/:id/returns', async (req, res) => {
  res
    .status(201)
    .json({ data: await requestReturn(objectId.parse(req.params.id), actor(res)._id, req.body) });
});
