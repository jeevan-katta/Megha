import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const schema = new Schema(
  {
    key: { type: String, unique: true },
    productId: String,
    quantity: Number,
    type: String,
    reason: String,
    actorId: String,
    orderId: String,
  },
  options,
);

schema.index({ productId: 1, createdAt: -1 });
export const Ledger = defineModel('InventoryTransaction', schema);
