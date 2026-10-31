import { stockAdjustmentSchema } from '@megha/validation';
import mongoose from 'mongoose';
import { DomainError } from '../../shared/errors/domain-error';
import { Audit } from '../audit/audit.model';
import { Product } from '../products/product.model';
import { Ledger } from './inventory-transaction.model';
export async function adjustStock(productId: string, input: unknown, actorId: string) {
  const data = stockAdjustmentSchema.parse(input);
  const key = 'adjust:' + data.idempotencyKey;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const previous = await Ledger.findOne({ key }).session(session);
      if (previous) {
        if (
          previous.productId !== productId ||
          previous.quantity !== data.quantity ||
          previous.actorId !== actorId
        )
          throw new DomainError(
            'IDEMPOTENCY_CONFLICT',
            'This adjustment key was already used.',
            409,
          );
        return;
      }
      const product = await Product.findOneAndUpdate(
        { _id: productId, $expr: { $gte: [{ $add: ['$stock', data.quantity] }, '$reserved'] } },
        { $inc: { stock: data.quantity } },
        { new: true, session },
      );
      if (!product)
        throw new DomainError(
          'STOCK_CONFLICT',
          'Stock cannot fall below reserved units. Refresh and retry.',
          409,
        );
      await Ledger.create(
        [
          {
            key,
            productId,
            quantity: data.quantity,
            type: data.type,
            reason: data.reason,
            actorId,
          },
        ],
        { session },
      );
      await Audit.create(
        [
          {
            actorId,
            action: 'STOCK_ADJUSTMENT',
            entity: 'inventory',
            entityId: productId,
            summary: data.reason,
            before: { stock: (product.stock ?? 0) - data.quantity },
            after: { stock: product.stock, type: data.type },
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return Product.findById(productId).lean();
}
