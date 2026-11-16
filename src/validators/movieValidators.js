import AppError from '../core/errors/AppError.js';

const MAX_SEARCH_QUERY_LENGTH = 200;
const MAX_TMDB_PAGE = 500;

function invalidSearchRequest() {
  return new AppError('Movie search parameters are invalid.', {
    statusCode: 400,
    code: 'VALIDATION_ERROR',
  });
}

export function validateMovieSearch(req, _res, next) {
  const query = req.query.query;
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  const rawPage = req.query.page;

  if (normalizedQuery.length === 0
    || Array.from(normalizedQuery).length > MAX_SEARCH_QUERY_LENGTH) {
    return next(invalidSearchRequest());
  }

  let page = 1;
  if (rawPage !== undefined) {
    if (typeof rawPage !== 'string' || !/^[1-9]\d*$/u.test(rawPage)) {
      return next(invalidSearchRequest());
    }

    page = Number(rawPage);
    if (!Number.isSafeInteger(page) || page > MAX_TMDB_PAGE) {
      return next(invalidSearchRequest());
    }
  }

  req.movieSearchInput = { query: normalizedQuery, page };
  return next();
}

export function validateTmdbId(req, _res, next) {
  const rawId = req.params.tmdbId;
  if (typeof rawId !== 'string' || !/^[1-9]\d*$/u.test(rawId)) {
    return next(new AppError('TMDB movie ID is invalid.', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    }));
  }

  const tmdbId = Number(rawId);
  if (!Number.isSafeInteger(tmdbId)) {
    return next(new AppError('TMDB movie ID is invalid.', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    }));
  }

  req.tmdbId = tmdbId;
  return next();
}
