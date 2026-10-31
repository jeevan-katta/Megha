import type { RequestInput } from '@megha/validation';
import { Entity } from './record.model';
/** Legacy records stay in their existing collection during this non-destructive refactor. */
export const recordRepository = {
  owned: (kind: string, userId: string) =>
    Entity.find({ kind, ownerId: userId }).sort({ createdAt: -1 }).limit(100).lean(),
  createRequest: (kind: string, input: RequestInput, userId?: string) =>
    Entity.create({
      ...input,
      kind,
      ownerId: userId,
      number: kind.slice(0, 3).toUpperCase() + '-' + Date.now().toString(36).toUpperCase(),
      status: 'NEW',
      history: [{ status: 'SUBMITTED', at: new Date() }],
    }),
  createPersonal: (
    kind: string,
    userId: string,
    input: { title: string; description?: string; data: Record<string, unknown> },
  ) =>
    // A product can be saved once; saving it again returns the existing record.
    kind === 'saved' && typeof input.data.productId === 'string'
      ? Entity.findOneAndUpdate(
          { kind, ownerId: userId, 'data.productId': input.data.productId },
          { $setOnInsert: { ...input, kind, ownerId: userId, status: 'ACTIVE' } },
          { upsert: true, new: true },
        ).orFail()
      : Entity.create({ ...input, kind, ownerId: userId, status: 'ACTIVE' }),
  markNotificationsRead: (userId: string) =>
    Entity.updateMany(
      { kind: 'notifications', ownerId: userId, status: 'UNREAD' },
      { $set: { status: 'READ' } },
    ),
  removePersonal: (id: string, userId: string) =>
    Entity.deleteOne({
      _id: id,
      ownerId: userId,
      kind: { $in: ['addresses', 'registered-machines', 'saved'] },
    }),
};
