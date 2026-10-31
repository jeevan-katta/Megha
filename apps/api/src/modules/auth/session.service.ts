import { createHash, randomBytes } from 'node:crypto';
import { userRepository } from '../users/user.repository';
import { Session } from './session.model';
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const sessionLifetime = 7 * 86400000;
export async function createSession(userId: unknown) {
  const token = randomBytes(32).toString('hex');
  await Session.create({
    hash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + sessionLifetime),
  });
  return token;
}
export async function resolveSession(token: string) {
  const session = await Session.findOne({ hash: hashToken(token), expiresAt: { $gt: new Date() } })
    .select('userId')
    .lean();
  return session ? userRepository.findActive(session.userId) : null;
}
export async function revokeSession(token?: string) {
  if (token) await Session.deleteOne({ hash: hashToken(token) });
}
