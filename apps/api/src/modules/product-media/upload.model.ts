import { Schema } from 'mongoose';
import { defineModel } from '../../database/model';
const options = { timestamps: true } as const;
const id = { type: Schema.Types.ObjectId };
const schema = new Schema(
  {
    ownerId: id,
    key: String,
    mime: String,
    size: Number,
    name: String,
    public: { type: Boolean, default: false },
  },
  options,
);

export const Upload = defineModel('Upload', schema);
