import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { config } from '../config';
import { DomainError } from '../shared/errors/domain-error';
export const requestContext: RequestHandler = (_req, res, next) => {
  res.locals.requestId = randomUUID();
  res.setHeader('X-Request-ID', res.locals.requestId);
  next();
};
export const validateOrigin: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers['sec-fetch-site'] === 'cross-site')
    return next(new DomainError('ORIGIN_DENIED', 'Cross-site request rejected.', 403));
  if (req.headers.origin && !config.origins.includes(req.headers.origin))
    return next(new DomainError('ORIGIN_DENIED', 'Origin not permitted.', 403));
  if (config.production && req.cookies.megha_session && !req.headers.origin)
    return next(
      new DomainError(
        'ORIGIN_REQUIRED',
        'Authenticated browser requests must include an origin.',
        403,
      ),
    );
  next();
};
