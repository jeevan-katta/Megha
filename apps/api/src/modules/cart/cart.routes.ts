import { storedCartSchema } from '@megha/validation';
import { Router } from 'express';
import { z } from 'zod';
import { actor, authenticated } from '../../middleware/authenticate.middleware';
import * as service from './cart.service';
export const cartRoutes = Router();
cartRoutes.use(authenticated);
cartRoutes.get('/', async (_req, res) => {
  res.json({ data: await service.getCart(actor(res)._id) });
});
cartRoutes.put('/', async (req, res) => {
  const { items } = z.object({ items: storedCartSchema }).strict().parse(req.body);
  res.json({ data: await service.saveCart(actor(res)._id, items) });
});
