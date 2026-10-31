import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const schema = new Schema(
  {
    key: { type: String, unique: true },
    provider: String,
    event: String,
    bodyHash: String,
    orderId: String,
    paymentId: String,
    processedAt: Date,
    processed: { type: Boolean, default: false },
  },
  options,
);

export const Event = defineModel('WebhookEvent', schema);
