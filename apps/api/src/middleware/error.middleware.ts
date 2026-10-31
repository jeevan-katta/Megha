import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { DomainError } from '../shared/errors/domain-error';
export const notFound: RequestHandler = (_req, _res, next) =>
  next(new DomainError('NOT_FOUND', 'Endpoint not found.', 404));
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const requestId = res.locals.requestId as string;
  // @megha/validation ships its own zod copy, so match by shape as well as by class.
  const zodLike =
    error instanceof ZodError ||
    ((error as { name?: string })?.name === 'ZodError' &&
      Array.isArray((error as { issues?: unknown }).issues));
  if (zodLike) {
    const issues = (error as ZodError).issues;
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the supplied fields.',
        fieldErrors: issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        requestId,
      },
    });
    return;
  }
  if (error instanceof DomainError) {
    res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message, requestId } });
    return;
  }
  const detail = error as { code?: number; name?: string; status?: number; type?: string };
  if (detail.name === 'MulterError') {
    res.status(400).json({
      error: { code: 'UPLOAD_REJECTED', message: 'Upload one image, up to 4 MB.', requestId },
    });
    return;
  }
  if (detail.name === 'VersionError') {
    res.status(409).json({
      error: {
        code: 'UPDATE_CONFLICT',
        message: 'This record changed. Refresh and retry.',
        requestId,
      },
    });
    return;
  }
  if (detail.code === 11000) {
    res
      .status(409)
      .json({ error: { code: 'DUPLICATE', message: 'That record already exists.', requestId } });
    return;
  }
  if (detail.name === 'CastError' || detail.type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: { code: 'INVALID_INPUT', message: 'Invalid request data.', requestId } });
    return;
  }
  if (detail.type === 'entity.too.large') {
    res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request exceeds the allowed size.',
        requestId,
      },
    });
    return;
  }
  console.error(
    JSON.stringify({ level: 'error', requestId, errorType: detail.name || 'UnknownError' }),
  );
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Unable to complete this request. Please retry.',
      requestId,
    },
  });
};
