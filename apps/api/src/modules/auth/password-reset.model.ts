import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const id = { type: Schema.Types.ObjectId };
const schema = new Schema(
  { hash: { type: String, unique: true }, userId: id, expiresAt: { type: Date, expires: 0 } },
  options,
);

export const Reset = defineModel('PasswordReset', schema);
