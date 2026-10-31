import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { z } from 'zod';
import { config } from '../../config';
import { DomainError } from '../../shared/errors/domain-error';
import { queueEmail } from '../email/email.service';
import { User } from '../users/user.model';
import { userRepository } from '../users/user.repository';
import { Reset } from './password-reset.model';
import { Session } from './session.model';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.validation';

const RESET_LIFETIME_MS = 30 * 60000;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function register(input: z.infer<typeof registerSchema>) {
  if (await userRepository.existsByEmail(input.email))
    throw new DomainError('EMAIL_EXISTS', 'An account already exists for that email.', 409);
  return userRepository.create({ ...input, password: await bcrypt.hash(input.password, 12) });
}
export async function login(input: z.infer<typeof loginSchema>) {
  const user = await userRepository.findByEmail(input.email);
  if (!user || !(await bcrypt.compare(input.password, user.password || '')))
    throw new DomainError('LOGIN_FAILED', 'Email or password is incorrect.', 401);
  return user;
}

/**
 * Emails a single-use reset link valid for 30 minutes. The answer is the same whether or not
 * the account exists, so the form cannot be used to discover registered emails.
 */
export async function requestPasswordReset(input: z.infer<typeof forgotPasswordSchema>) {
  const user = await User.findOne({ email: input.email, active: true }, { email: 1, name: 1 });
  if (!user) return;
  const token = randomBytes(32).toString('hex');
  const hash = hashToken(token);
  // Only the newest link works.
  await Reset.deleteMany({ userId: user._id });
  await Reset.create({
    hash,
    userId: user._id,
    expiresAt: new Date(Date.now() + RESET_LIFETIME_MS),
  });
  await queueEmail({
    key: 'password-reset:' + hash,
    to: user.email,
    subject: 'Reset your Megha password',
    heading: 'Reset your password',
    lines: [
      `Hello ${user.name ?? 'there'},`,
      'We received a request to reset the password for your Megha Laundry Equipment account. The link below works once and expires in 30 minutes.',
      "If you didn't ask for this, you can ignore this email; your password will not change.",
    ],
    action: {
      label: 'Choose a new password',
      url: config.siteUrl + '/reset-password?token=' + token,
    },
    sensitive: true,
  });
}

/** Sets a new password from a valid link, uses the link up and signs out every session. */
export async function resetPassword(input: z.infer<typeof resetPasswordSchema>) {
  const reset = await Reset.findOneAndDelete({
    hash: hashToken(input.token),
    expiresAt: { $gt: new Date() },
  });
  if (!reset)
    throw new DomainError(
      'RESET_INVALID',
      'This reset link has expired or was already used. Request a new one.',
      400,
    );
  const user = await User.findOneAndUpdate(
    { _id: reset.userId, active: true },
    { $set: { password: await bcrypt.hash(input.password, 12) } },
    { new: true, projection: { email: 1, name: 1 } },
  );
  if (!user) throw new DomainError('RESET_INVALID', 'This account is no longer active.', 400);
  await Session.deleteMany({ userId: user._id });
  await queueEmail({
    key: 'password-changed:' + String(user._id) + ':' + Date.now(),
    to: user.email,
    subject: 'Your Megha password was changed',
    heading: 'Your password was changed',
    lines: [
      `Hello ${user.name ?? 'there'},`,
      'The password for your Megha Laundry Equipment account was just changed and you were signed out everywhere.',
      "If this wasn't you, reset your password again straight away and contact us.",
    ],
    action: { label: 'Sign in', url: config.siteUrl + '/account' },
  });
}
