import { type CartItem, type Product, type Totals } from '@megha/types';
import { DomainError } from '../../shared/errors/domain-error';

export type PricedProduct = Pick<
  Product,
  '_id' | 'name' | 'sku' | 'image' | 'price' | 'gstRate' | 'stock' | 'reserved' | 'active'
>;

export function calculate(items: CartItem[], products: PricedProduct[], shipping = 12000): Totals {
  if (!items.length) throw new DomainError('CART_EMPTY', 'Your cart is empty.');
  if (!Number.isSafeInteger(shipping) || shipping < 0)
    throw new DomainError('INVALID_SHIPPING', 'A valid shipping quote is required.');
  const merged = new Map<string, number>();
  for (const i of items) {
    if (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 100)
      throw new DomainError('INVALID_QUANTITY', 'Quantity must be between 1 and 100.');
    merged.set(i.productId, (merged.get(i.productId) || 0) + i.quantity);
  }
  const lines = [...merged].map(([id, quantity]) => {
    const p = products.find((p) => String(p._id) === id);
    if (!p || !p.active)
      throw new DomainError('PRODUCT_INACTIVE', 'A selected part is no longer available.');
    if (
      !Number.isSafeInteger(p.price) ||
      p.price < 1 ||
      !Number.isFinite(p.gstRate) ||
      p.gstRate < 0 ||
      p.gstRate > 100 ||
      !Number.isSafeInteger(p.stock) ||
      !Number.isSafeInteger(p.reserved) ||
      p.reserved < 0
    )
      throw new DomainError(
        'INVALID_PRODUCT_DATA',
        'This part requires approved pricing and inventory.',
      );
    if (quantity > 100 || p.stock - p.reserved < quantity)
      throw new DomainError('OUT_OF_STOCK', p.name + ' has insufficient stock.');
    const base = p.price * quantity;
    const tax = Math.round((base * p.gstRate) / 100);
    return {
      productId: id,
      name: p.name,
      sku: p.sku,
      image: p.image,
      quantity,
      unitPrice: p.price,
      gstRate: p.gstRate,
      tax,
      total: base + tax,
    };
  });
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    tax = lines.reduce((s, l) => s + l.tax, 0);
  return { items: lines, subtotal, tax, shipping, total: subtotal + tax + shipping };
}
