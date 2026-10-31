import { Router } from 'express';
import * as controller from './product.controller';
export const productRoutes = Router();
productRoutes.get('/', controller.list);
productRoutes.get('/:slug', controller.detail);
