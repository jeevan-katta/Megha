import type { RequestHandler } from 'express';
import * as service from './product.service';
import { productQuery } from './product.validation';
export const list: RequestHandler = async (req, res) => {
  res.json(await service.listProducts(productQuery.parse(req.query)));
};
export const detail: RequestHandler = async (req, res) => {
  res.json({ data: await service.getProduct(String(req.params.slug)) });
};
