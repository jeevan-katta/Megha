import { permitted } from '@megha/constants';
import type { RequestHandler } from 'express';
import { DomainError } from '../shared/errors/domain-error';
import { actor } from './authenticate.middleware';
export function authorize(module: string): RequestHandler {
  return (_req, res, next) => {
    try {
      if (!permitted(actor(res).role, module))
        throw new DomainError('FORBIDDEN', 'You do not have permission for this action.', 403);
      next();
    } catch (error) {
      next(error);
    }
  };
}
