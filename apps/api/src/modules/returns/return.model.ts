import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const schema = new Schema(
  {
    number: { type: String, unique: true },
    orderId: { type: String, required: true },
    orderNumber: String,
    userId: String,
    items: [{ productId: String, name: String, sku: String, quantity: Number, unitPrice: Number }],
    reason: String,
    comments: String,
    status: { type: String, default: 'REQUESTED' },
    decisionNotes: String,
    receivedItems: [{ productId: String, quantity: Number, condition: String }],
    refundId: String,
    history: [{ status: String, at: Date, actor: String, description: String }],
    idempotencyKey: { type: String, unique: true },
  },
  options,
);
schema.index({ orderId: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ createdAt: -1, _id: -1 });
export const Return = defineModel('Return', schema);
