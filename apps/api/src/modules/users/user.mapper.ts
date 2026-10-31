import type { InferSchemaType } from 'mongoose';
import { User } from './user.model';
export function publicUser(user: InferSchemaType<typeof User.schema> & { _id: unknown }) {
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    company: user.company,
    gstin: user.gstin,
  };
}
