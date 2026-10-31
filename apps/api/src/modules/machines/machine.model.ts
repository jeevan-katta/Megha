import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const schema = new Schema(
  {
    name: String,
    slug: { type: String, unique: true },
    image: String,
    category: String,
    capacity: String,
    description: String,
    specifications: [{ label: String, value: String }],
    active: Boolean,
  },
  options,
);

export const Machine = defineModel('Machine', schema);
