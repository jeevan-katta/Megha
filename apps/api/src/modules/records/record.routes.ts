import { Router } from 'express';
import type { Actor } from '../../middleware/authenticate.middleware';
import { rateLimit } from '../../middleware/rate-limit.middleware';
import { submitRequest } from './record.service';
export const requestRoutes = Router();
requestRoutes.post('/:kind', rateLimit('public-forms', 30, 15 * 60000), async (req, res) => {
  res.status(201).json({
    data: await submitRequest(
      req.params.kind,
      req.body,
      (res.locals.user as Actor | undefined)?._id,
    ),
  });
});
