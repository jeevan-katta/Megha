import { Schema, type ClientSession } from 'mongoose';
import { defineModel } from '../../database/model';
const Counter = defineModel(
  'Counter',
  new Schema({ _id: String, value: { type: Number, default: 0 } }, { versionKey: false }),
);
/** Atomic yearly sequence, e.g. MEGHA-2026-000125. Gaps are possible if a transaction aborts. */
export async function nextNumber(prefix: string, session?: ClientSession) {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: prefix + ':' + year },
    { $inc: { value: 1 } },
    { upsert: true, new: true, session },
  );
  return `${prefix}-${year}-${String(counter.value).padStart(6, '0')}`;
}
