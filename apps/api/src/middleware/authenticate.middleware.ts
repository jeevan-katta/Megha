import type { RequestHandler, Response } from 'express';
import { resolveSession } from '../modules/auth/session.service';
import { publicUser } from '../modules/users/user.mapper';
import { DomainError } from '../shared/errors/domain-error';
export interface Actor {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  company?: string;
  gstin?: string;
}
export function actor(res: Response): Actor {
  const user = res.locals.user as Actor | undefined;
  if (!user) throw new DomainError('UNAUTHORIZED', 'Please sign in to continue.', 401);
  return user;
}
export const identify: RequestHandler = async (req, res, next) => {
  try {
    const token = req.cookies.megha_session;
    if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
      const user = await resolveSession(token);
      if (user) res.locals.user = publicUser(user);
    }
    next();
  } catch (error) {
    next(error);
  }
};
export const authenticated: RequestHandler = (_req, res, next) => {
  try {
    actor(res);
    next();
  } catch (error) {
    next(error);
  }
};
