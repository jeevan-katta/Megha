import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const schema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true },
    sku: { type: String, unique: true },
    partNumber: String,
    category: String,
    image: String,
    description: String,
    price: { type: Number, min: 0 },
    gstRate: Number,
    stock: { type: Number, min: 0 },
    reserved: { type: Number, min: 0, default: 0 },
    threshold: { type: Number, default: 5 },
    active: Boolean,
    featured: Boolean,
    keywords: [String],
    specifications: [{ label: String, value: String }],
    developmentOnly: Boolean,
    /** Shipping weight (kg) and packed dimensions (cm) for courier rates. */
    weight: Number,
    length: Number,
    breadth: Number,
    height: Number,
  },
  options,
);
schema.index({ name: 'text', sku: 'text', partNumber: 'text', keywords: 'text' });
schema.index({ createdAt: -1, _id: -1 });
export const Product = defineModel('Product', schema);
