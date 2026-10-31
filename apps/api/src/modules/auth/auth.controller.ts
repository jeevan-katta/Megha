import type { RequestHandler, Response } from 'express';
import { config } from '../../config';
import { publicUser } from '../users/user.mapper';
import * as service from './auth.service';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.validation';
import { createSession, revokeSession, sessionLifetime } from './session.service';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.production,
  path: '/',
};
async function session(res: Response, id: unknown) {
  res.cookie('megha_session', await createSession(id), {
    ...cookieOptions,
    maxAge: sessionLifetime,
  });
}
export const register: RequestHandler = async (req, res) => {
  const user = await service.register(registerSchema.parse(req.body));
  await session(res, user._id);
  res.status(201).json({ data: publicUser(user) });
};
export const login: RequestHandler = async (req, res) => {
  const user = await service.login(loginSchema.parse(req.body));
  await session(res, user._id);
  res.json({ data: publicUser(user) });
};
export const logout: RequestHandler = async (req, res) => {
  await revokeSession(req.cookies.megha_session);
  res.clearCookie('megha_session', cookieOptions);
  res.json({ data: { ok: true } });
};
export const forgotPassword: RequestHandler = async (req, res) => {
  await service.requestPasswordReset(forgotPasswordSchema.parse(req.body));
  res.json({
    data: {
      message:
        'If an account exists for that email, we have sent a link to reset the password. It expires in 30 minutes.',
    },
  });
};
export const resetPassword: RequestHandler = async (req, res) => {
  await service.resetPassword(resetPasswordSchema.parse(req.body));
  res.clearCookie('megha_session', cookieOptions);
  res.json({ data: { message: 'Your password has been changed. Please sign in.' } });
};
