import AppError from '../core/errors/AppError.js';
import { env } from '../config/env.js';

const ALLOWED_STATUS = new Set(['watched', 'plan_to_watch']);
const ALLOWED_VISIBILITY = new Set(['public', 'private']);
const ALLOWED_FIELDS = new Set(['tmdbId', 'status', 'visibility']);
const ALLOWED_UPDATE_FIELDS = new Set(['status', 'visibility']);
const ALLOWED_LIST_QUERY = new Set(['status', 'page', 'limit']);

function invalidLibraryRequest() {
  return new AppError('Library entry data is invalid.', {
    statusCode: 400,
    code: 'VALIDATION_ERROR',
  });
}

export function validateAddLibraryEntry(req, _res, next) {
  const body = req.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return next(invalidLibraryRequest());
  }

  if (Object.keys(body).some((field) => !ALLOWED_FIELDS.has(field))) {
    return next(invalidLibraryRequest());
  }

  const tmdbId = typeof body.tmdbId === 'number'
    ? body.tmdbId
    : typeof body.tmdbId === 'string' && /^[1-9]\d*$/u.test(body.tmdbId)
      ? Number(body.tmdbId)
      : NaN;
  const status = body.status ?? 'plan_to_watch';
  const visibility = body.visibility ?? 'private';

  if (!Number.isSafeInteger(tmdbId)
    || tmdbId <= 0
    || !ALLOWED_STATUS.has(status)
    || !ALLOWED_VISIBILITY.has(visibility)) {
    return next(invalidLibraryRequest());
  }

  req.libraryEntryInput = { tmdbId, status, visibility };
  return next();
}

export function validateListLibrary(req, _res, next) {
  const query = req.query;
  if (Object.keys(query).some((field) => !ALLOWED_LIST_QUERY.has(field))) {
    return next(invalidLibraryRequest());
  }

  const status = query.status;
  if (status !== undefined && !ALLOWED_STATUS.has(status)) {
    return next(invalidLibraryRequest());
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
    return next(invalidLibraryRequest());
  }

  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) {
    return next(invalidLibraryRequest());
  }

  req.libraryListInput = { status, page, limit, skip };
  return next();
}

export function validateLibraryTmdbId(req, _res, next) {
  const rawId = req.params.tmdbId;
  if (typeof rawId !== 'string' || !/^[1-9]\d*$/u.test(rawId)) {
    return next(invalidLibraryRequest());
  }

  const tmdbId = Number(rawId);
  if (!Number.isSafeInteger(tmdbId)) {
    return next(invalidLibraryRequest());
  }

  req.libraryTmdbId = tmdbId;
  return next();
}

export function validateUpdateLibraryEntry(req, _res, next) {
  const body = req.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return next(invalidLibraryRequest());
  }

  const fields = Object.keys(body);
  if (fields.length === 0 || fields.some((field) => !ALLOWED_UPDATE_FIELDS.has(field))) {
    return next(invalidLibraryRequest());
  }

  if ((Object.hasOwn(body, 'status') && !ALLOWED_STATUS.has(body.status))
    || (Object.hasOwn(body, 'visibility') && !ALLOWED_VISIBILITY.has(body.visibility))) {
    return next(invalidLibraryRequest());
  }

  req.libraryUpdateInput = body;
  return next();
}
