import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true, optimisticConcurrency: true } as const;
const id = { type: Schema.Types.ObjectId };
const schema = new Schema(
  {
    kind: { type: String, index: true },
    number: String,
    ownerId: { ...id, index: true },
    title: String,
    name: String,
    email: String,
    phone: String,
    description: String,
    status: String,
    data: { type: Schema.Types.Mixed, default: {} },
    history: [{ status: String, at: Date }],
  },
  options,
);

schema.index({ kind: 1, createdAt: -1, _id: -1 });
schema.index({ ownerId: 1, kind: 1, createdAt: -1 });
// One notification per event key per customer, so retried webhooks never notify twice.
schema.index(
  { ownerId: 1, number: 1 },
  { unique: true, partialFilterExpression: { kind: 'notifications', number: { $type: 'string' } } },
);
export const Entity = defineModel('Entity', schema);
