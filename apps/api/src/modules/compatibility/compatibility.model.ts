import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const schema = new Schema(
  {
    machineModelId: { type: String, required: true },
    productId: { type: String, required: true },
    verified: { type: Boolean, default: false },
    notes: String,
    verifiedBy: String,
    verifiedAt: Date,
  },
  options,
);
schema.index({ machineModelId: 1, productId: 1 }, { unique: true });
export const Compatibility = defineModel('Compatibility', schema);
