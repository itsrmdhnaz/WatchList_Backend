import AppError from '../core/errors/AppError.js';
import { verifyAccessToken } from '../services/accessTokenService.js';

const BEARER_PATTERN = /^Bearer\s+([^\s]+)$/iu;
const MAX_ACCESS_TOKEN_LENGTH = 4096;

function rejectAuthentication(res, next) {
  res.set('WWW-Authenticate', 'Bearer realm="movie-platform"');
  return next(new AppError('Authentication is required.', {
    statusCode: 401,
    code: 'UNAUTHORIZED',
  }));
}

export async function requireAuth(req, res, next) {
  const authorization = req.get('authorization');
  const match = typeof authorization === 'string'
    ? BEARER_PATTERN.exec(authorization)
    : null;

  if (!match || match[1].length > MAX_ACCESS_TOKEN_LENGTH) {
    return rejectAuthentication(res, next);
  }

  let userId;
  try {
    const payload = await verifyAccessToken(match[1]);
    if (typeof payload.sub !== 'string' || !/^[1-9]\d*$/u.test(payload.sub)) {
      return rejectAuthentication(res, next);
    }

    userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return rejectAuthentication(res, next);
    }
  } catch {
    return rejectAuthentication(res, next);
  }

  req.auth = Object.freeze({ userId });
  return next();
}
