import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const schema = new Schema(
  {
    orderId: { type: String, required: true },
    orderNumber: String,
    returnId: String,
    paymentId: String,
    /** Paise. */
    amount: Number,
    reason: String,
    status: { type: String, default: 'PENDING' },
    providerRefundId: String,
    requestedBy: String,
    processedAt: Date,
    failureReason: String,
    idempotencyKey: { type: String, unique: true },
  },
  options,
);
schema.index({ orderId: 1, createdAt: -1 });
schema.index({ providerRefundId: 1 });
export const Refund = defineModel('Refund', schema);
