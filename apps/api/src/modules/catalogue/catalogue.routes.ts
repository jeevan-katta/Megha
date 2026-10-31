import { Router } from 'express';
import { catalogue } from './catalogue.service';
export const catalogueRoutes = Router();
catalogueRoutes.get('/', async (_req, res) => {
  res.json({ data: await catalogue() });
});
