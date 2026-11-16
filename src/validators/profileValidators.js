import AppError from '../core/errors/AppError.js';
import { env } from '../config/env.js';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ALLOWED_STATUS = new Set(['watched', 'plan_to_watch']);
const ALLOWED_QUERY_FIELDS = new Set(['status', 'page', 'limit']);

export function validatePublicId(req, _res, next) {
  const publicId = req.params.publicId;
  if (typeof publicId !== 'string' || !UUID_V4_PATTERN.test(publicId)) {
    return next(new AppError('Public profile ID is invalid.', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    }));
  }

  req.publicId = publicId.toLowerCase();
  return next();
}

export function validateProfileMoviesQuery(req, _res, next) {
  const query = req.query;
  if (Object.keys(query).some((field) => !ALLOWED_QUERY_FIELDS.has(field))) {
    return next(new AppError('Profile movie query is invalid.', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    }));
  }

  const status = query.status;
  if (status !== undefined && !ALLOWED_STATUS.has(status)) {
    return next(new AppError('Profile movie query is invalid.', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    }));
  }

  function readPositiveInteger(value, fallback) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/u.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  const page = readPositiveInteger(query.page, 1);
  const limit = readPositiveInteger(query.limit, env.defaultPageSize);
  if (page === null || limit === null || limit > env.maxPageSize) {
    return next(new AppError('Profile movie query is invalid.', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    }));
  }

  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) {
    return next(new AppError('Profile movie query is invalid.', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    }));
  }

  req.profileMoviesInput = { status, page, limit, skip };
  return next();
}
