import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const id = { type: Schema.Types.ObjectId };
const schema = new Schema(
  { userId: { ...id, unique: true }, items: [{ productId: String, quantity: Number }] },
  options,
);

export const Cart = defineModel('Cart', schema);
