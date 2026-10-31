import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const schema = new Schema(
  {
    actorId: String,
    action: String,
    entity: String,
    entityId: String,
    summary: String,
    /** Only the fields that changed; never secrets or raw provider payloads. */
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    requestId: String,
  },
  options,
);

schema.index({ createdAt: -1, _id: -1 });
schema.index({ entity: 1, entityId: 1, createdAt: -1 });
export const Audit = defineModel('Audit', schema);
