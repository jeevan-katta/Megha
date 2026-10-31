import { staffCreateSchema, staffUpdateSchema } from '@megha/validation';
import bcrypt from 'bcryptjs';
import type { Actor } from '../../middleware/authenticate.middleware';
import { DomainError } from '../../shared/errors/domain-error';
import { Session } from '../auth/session.model';
import { User } from './user.model';
export async function saveStaff(module: string, input: unknown, actor: Actor, id?: string) {
  const data = id ? staffUpdateSchema.parse(input) : staffCreateSchema.parse(input);
  const current = id ? await User.findById(id) : null;
  if (id && !current) throw new DomainError('NOT_FOUND', 'User not found.', 404);
  if (
    module === 'customers' &&
    ((data.role && data.role !== 'CUSTOMER') || (current && current.role !== 'CUSTOMER'))
  )
    throw new DomainError('FORBIDDEN', 'Customer management cannot change staff accounts.', 403);
  if (
    module === 'technicians' &&
    ((data.role && data.role !== 'TECHNICIAN') || (current && current.role !== 'TECHNICIAN'))
  )
    throw new DomainError('FORBIDDEN', 'This module manages technicians only.', 403);
  if (
    actor.role !== 'SUPER_ADMIN' &&
    (data.role === 'SUPER_ADMIN' || current?.role === 'SUPER_ADMIN')
  )
    throw new DomainError('FORBIDDEN', 'Only a super administrator can manage this account.', 403);
  if (id === actor._id && ((data.role && data.role !== actor.role) || data.active === false))
    throw new DomainError('SELF_LOCKOUT', 'You cannot remove your own access.');
  if (!id) {
    const { password, ...profile } = staffCreateSchema.parse(input);
    const user = await User.create({ ...profile, password: await bcrypt.hash(password, 12) });
    return User.findById(user._id).lean();
  }
  const user = await User.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  if (data.active === false || (data.role && data.role !== current?.role))
    await Session.deleteMany({ userId: id });
  return user;
}
