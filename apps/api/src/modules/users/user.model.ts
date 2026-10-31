import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const schema = new Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: { type: String, select: false },
    role: { type: String, default: 'CUSTOMER' },
    phone: String,
    company: String,
    gstin: String,
    active: { type: Boolean, default: true },
  },
  options,
);

schema.index({ role: 1, createdAt: -1, _id: -1 });
schema.index({ createdAt: -1, _id: -1 });
export const User = defineModel('User', schema);
