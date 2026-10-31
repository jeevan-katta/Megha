import { Router } from 'express';
import { rateLimit } from '../../middleware/rate-limit.middleware';
import * as controller from './auth.controller';
export const authRoutes = Router();
authRoutes.post('/register', rateLimit('auth', 30, 15 * 60000), controller.register);
authRoutes.post('/login', rateLimit('auth', 30, 15 * 60000), controller.login);
authRoutes.post('/logout', controller.logout);
// Separate, tighter limits so reset emails cannot be used to flood an inbox.
authRoutes.post(
  '/forgot-password',
  rateLimit('password-reset', 10, 15 * 60000),
  controller.forgotPassword,
);
authRoutes.post(
  '/reset-password',
  rateLimit('password-reset', 10, 15 * 60000),
  controller.resetPassword,
);
