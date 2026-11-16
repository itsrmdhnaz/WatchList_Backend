import { env } from '../../config/env.js';

export class TmdbClientError extends Error {
  constructor(message, { statusCode = 502, code = 'TMDB_UPSTREAM_ERROR', upstreamStatus } = {}) {
    super(message);
    this.name = 'TmdbClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.upstreamStatus = upstreamStatus;
    Error.captureStackTrace?.(this, TmdbClientError);
  }
}

function mapUpstreamStatus(status) {
  if (status === 404) {
    return { statusCode: 404, code: 'TMDB_RESOURCE_NOT_FOUND' };
  }

  if (status === 429 || status >= 500) {
    return { statusCode: 503, code: 'TMDB_UNAVAILABLE' };
  }

  if (status === 401 || status === 403) {
    return { statusCode: 503, code: 'TMDB_AUTHENTICATION_FAILED' };
  }

  return { statusCode: 502, code: 'TMDB_UPSTREAM_ERROR' };
}

/** Creates a small HTTP client for the TMDB v3 movie endpoints. */
export function createTmdbClient({
  apiKey = env.tmdbApiKey,
  baseUrl = env.tmdbBaseUrl,
  language = env.tmdbLanguage,
  timeoutMs = env.tmdbRequestTimeoutMs,
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  async function get(path, params = {}) {
    if (!apiKey) {
      throw new TmdbClientError('Movie provider is not configured.', {
        statusCode: 503,
        code: 'TMDB_NOT_CONFIGURED',
      });
    }

    const url = new URL(path.replace(/^\/+/, ''), normalizedBaseUrl);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('language', language);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    let response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      throw new TmdbClientError(
        timedOut ? 'Movie provider request timed out.' : 'Movie provider request failed.',
        {
          statusCode: timedOut ? 504 : 502,
          code: timedOut ? 'TMDB_TIMEOUT' : 'TMDB_NETWORK_ERROR',
        },
      );
    }

    if (!response.ok) {
      const mapped = mapUpstreamStatus(response.status);
      throw new TmdbClientError('Movie provider returned an error.', {
        ...mapped,
        upstreamStatus: response.status,
      });
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new TmdbClientError('Movie provider returned an invalid response.', {
        statusCode: 502,
        code: 'TMDB_INVALID_RESPONSE',
        upstreamStatus: response.status,
      });
    }

    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new TmdbClientError('Movie provider returned an invalid response.', {
        statusCode: 502,
        code: 'TMDB_INVALID_RESPONSE',
        upstreamStatus: response.status,
      });
    }

    return data;
  }

  return Object.freeze({
    searchMovies(query, page = 1) {
      if (typeof query !== 'string' || query.trim().length === 0) {
        throw new TypeError('Movie search query must be a non-empty string.');
      }
      if (!Number.isSafeInteger(page) || page < 1) {
        throw new TypeError('Movie search page must be a positive safe integer.');
      }

      return get('search/movie', { query: query.trim(), page });
    },

    getPopularMovies(page = 1) {
      if (!Number.isSafeInteger(page) || page < 1 || page > 500) {
        throw new TypeError('TMDB movie page must be an integer between 1 and 500.');
      }

      return get('movie/popular', { page });
    },

    getMovieDetails(tmdbId) {
      if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
        throw new TypeError('TMDB movie ID must be a positive safe integer.');
      }

      return get(`movie/${tmdbId}`, {
        append_to_response: 'credits,images,recommendations',
      });
    },
  });
}
