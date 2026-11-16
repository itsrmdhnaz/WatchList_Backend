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
    : isMalformedJson ? 400 : isOversizedBody ? 413 : 500;
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

  if (statusCode >= 500) {
    logger.error('Request failed', {
      errorName: error instanceof Error ? error.name : 'NonErrorThrown',
      statusCode,
      code,
    });
  }

  return res.status(statusCode).json({
    success: false,
    message,
    error: { code },
  });
}
