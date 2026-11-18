
import AppError from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export default function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const isAppError = error instanceof AppError;
  const isMalformedJson = error?.type === 'entity.parse.failed';
  const isOversizedBody = error?.type === 'entity.too.large';

  const statusCode = isAppError
    ? error.statusCode
    : isMalformedJson ? 400
      : isOversizedBody ? 413
        : 500;

  const message = isAppError
    ? error.message
    : isMalformedJson ? 'Request body contains invalid JSON.'
      : isOversizedBody ? 'Request body is too large.'
        : 'Something went wrong';

  const code = isAppError
    ? error.code
    : isMalformedJson ? 'INVALID_JSON'
      : isOversizedBody ? 'PAYLOAD_TOO_LARGE'
        : 'INTERNAL_SERVER_ERROR';

  // Log every error with complete diagnostic information.
  logger.error({
    err: error instanceof Error ? error : undefined,
    errorName: error?.name ?? 'NonErrorThrown',
    errorMessage: error instanceof Error
      ? error.message
      : String(error),
    errorStack: error instanceof Error
      ? error.stack
      : undefined,
    errorCode: error?.code ?? null,
    errorMeta: error?.meta ?? null,
    errorCause: error?.cause ?? null,
    statusCode,
    responseCode: code,
    request: {
      method: req.method,
      path: req.path,
    },
  }, 'Request failed');

  return res.status(statusCode).json({
    success: false,
    message,
    error: { code },
  });
}
