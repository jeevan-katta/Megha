import type { RequestHandler } from 'express';
/** Execution time including database/auth middleware, available in browser network tools. */
export const timing: RequestHandler = (_req, res, next) => {
  const start = performance.now();
  const json = res.json;
  res.json = function (body) {
    res.setHeader('Server-Timing', `app;dur=${(performance.now() - start).toFixed(1)}`);
    return json.call(this, body);
  };
  next();
};
