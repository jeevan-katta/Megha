import type { CartItem } from '@megha/types';
import { Cart } from './cart.model';
export async function getCart(userId: string) {
  return (await Cart.findOne({ userId }).lean())?.items || [];
}
export async function saveCart(userId: string, items: CartItem[]) {
  await Cart.updateOne({ userId }, { $set: { items } }, { upsert: true, runValidators: true });
  return items;
}
