import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const schema = new Schema(
  { name: String, slug: { type: String, unique: true }, image: String },
  options,
);

export const Category = defineModel('Category', schema);
