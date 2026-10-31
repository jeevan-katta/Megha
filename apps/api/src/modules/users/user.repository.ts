import { profileSchema } from '@megha/validation';
import type { z } from 'zod';
import { User } from './user.model';
export const userRepository = {
  findByEmail: (email: string) => User.findOne({ email, active: true }).select('+password'),
  existsByEmail: (email: string) => User.exists({ email }),
  findActive: (id: unknown) => User.findOne({ _id: id, active: true }).lean(),
  create: (input: { name: string; email: string; password: string }) =>
    User.create({ ...input, role: 'CUSTOMER' }),
  updateProfile: (id: string, input: z.infer<typeof profileSchema>) =>
    User.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }),
};
