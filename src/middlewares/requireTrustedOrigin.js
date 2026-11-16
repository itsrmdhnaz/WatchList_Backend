import { isAllowedOrigin } from '../config/env.js';
import AppError from '../core/errors/AppError.js';

export function requireTrustedOrigin(req, _res, next) {
  const origin = req.get('origin');
  if (origin === undefined) {
    return next();
  }

  if (!isAllowedOrigin(origin)) {
    return next(new AppError('Request origin is not allowed.', {
      statusCode: 403,
      code: 'FORBIDDEN_ORIGIN',
    }));
  }

  return next();
}
