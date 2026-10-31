import type { InferSchemaType } from 'mongoose';
import type { PricedProduct } from '../pricing/pricing.service';
import { Product } from './product.model';

/** Missing commercial values remain invalid; never invent a sale price or stock. */
export function pricingProduct(
  product: InferSchemaType<typeof Product.schema> & { _id: unknown },
): PricedProduct {
  return {
    _id: String(product._id),
    name: product.name ?? '',
    sku: product.sku ?? '',
    image: product.image ?? '',
    price: product.price ?? NaN,
    gstRate: product.gstRate ?? NaN,
    stock: product.stock ?? NaN,
    reserved: product.reserved ?? 0,
    active: product.active ?? false,
  };
}
