import AppError from '../core/errors/AppError.js';
import { env } from '../config/env.js';
import { TmdbClientError } from '../integrations/tmdb/tmdbClient.js';
import { logger } from '../core/utils/logger.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function invalidTmdbResponse() {
  return new AppError('Movie provider returned an invalid response.', {
    statusCode: 502,
    code: 'TMDB_INVALID_RESPONSE',
  });
}

function invalidTmdbDetails() {
  return new TmdbClientError('Movie provider returned an invalid response.', {
    statusCode: 502,
    code: 'TMDB_INVALID_RESPONSE',
  });
}

function toMovieSummary(movie) {
  if (movie === null
    || typeof movie !== 'object'
    || !Number.isSafeInteger(movie.id)
    || movie.id <= 0
    || typeof movie.title !== 'string') {
    throw invalidTmdbResponse();
  }

  return {
    tmdbId: movie.id,
    title: movie.title,
    overview: typeof movie.overview === 'string' ? movie.overview : null,
    releaseDate: typeof movie.release_date === 'string' && movie.release_date.length > 0
      ? movie.release_date
      : null,
    posterPath: typeof movie.poster_path === 'string' ? movie.poster_path : null,
    backdropPath: typeof movie.backdrop_path === 'string' ? movie.backdrop_path : null,
    voteAverage: Number.isFinite(movie.vote_average) ? movie.vote_average : 0,
    voteCount: Number.isSafeInteger(movie.vote_count) && movie.vote_count >= 0
      ? movie.vote_count
      : 0,
  };
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeTmdbImageUrl(path) {
  const cleaned = normalizeString(path);
  if (!cleaned) {
    return null;
  }

  return cleaned.startsWith('http://') || cleaned.startsWith('https://')
    ? cleaned
    : `https://image.tmdb.org/t/p/original${cleaned}`;
}

function resolveYear(dateLike) {
  const releaseDate = normalizeString(dateLike);
  if (!releaseDate || releaseDate.length < 4) {
    return null;
  }

  const year = Number(releaseDate.slice(0, 4));
  return Number.isInteger(year) ? year : null;
}

function resolveRating(primaryValue, fallbackValue = 0) {
  if (Number.isFinite(primaryValue)) {
    return primaryValue;
  }

  return Number.isFinite(fallbackValue) ? fallbackValue : 0;
}

function normalizeImageCollection(values) {
  return values
    .map((item) => normalizeTmdbImageUrl(item?.file_path ?? item?.path ?? item?.poster_path ?? item?.backdrop_path ?? item?.logo_path ?? item?.profile_path))
    .filter(Boolean);
}

function normalizeCastList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((person) => ({
      id: Number.isSafeInteger(person?.id) ? person.id : null,
      name: normalizeString(person?.name),
      character: normalizeString(person?.character),
      profileUrl: normalizeTmdbImageUrl(person?.profile_path),
    }))
    .filter((person) => person.name || person.character || person.profileUrl);
}

function normalizeCrewNames(values, matchers) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((person) => {
      const job = String(person?.job ?? '').trim();
      return matchers.some((matcher) => matcher.test(job));
    })
    .map((person) => normalizeString(person?.name))
    .filter(Boolean);
}

function toMovieRecord(movie, tmdbId) {
  if (movie === null
    || typeof movie !== 'object'
    || movie.id !== tmdbId
    || typeof movie.title !== 'string'
    || movie.title.length === 0) {
    throw invalidTmdbDetails();
  }

  const releaseDate = normalizeString(movie.release_date);
  const crew = Array.isArray(movie.credits?.crew) ? movie.credits.crew : [];
  const images = movie.images && typeof movie.images === 'object' ? movie.images : {};
  const genres = Array.isArray(movie.genres)
    ? movie.genres.map((item) => normalizeString(item?.name)).filter(Boolean)
    : [];
  const country = Array.isArray(movie.origin_country)
    ? movie.origin_country.map((item) => normalizeString(item)).filter(Boolean)
    : Array.isArray(movie.production_countries)
      ? movie.production_countries
        .map((item) => normalizeString(item?.name ?? item?.iso_3166_1))
        .filter(Boolean)
      : [];
  const language = Array.isArray(movie.spoken_languages)
    ? movie.spoken_languages
      .map((item) => normalizeString(item?.english_name ?? item?.name))
      .filter(Boolean)
    : [];
  const normalizedGenres = Array.isArray(movie.genres)
    ? movie.genres
      .map((genre) => ({
        tmdbId: Number.isSafeInteger(genre?.id) ? genre.id : null,
        name: normalizeString(genre?.name),
      }))
      .filter((genre) => genre.tmdbId !== null && genre.name)
    : [];
  const normalizedCompanies = Array.isArray(movie.production_companies)
    ? movie.production_companies
      .map((company) => ({
        id: Number.isSafeInteger(company?.id) ? company.id : null,
        name: normalizeString(company?.name),
        logoPath: normalizeTmdbImageUrl(company?.logo_path),
      }))
      .filter((company) => company.id !== null && company.name)
    : [];

  const similarMovies = Array.isArray(movie.recommendations?.results)
    ? movie.recommendations.results
      .slice(0, 10)
      .map((item) => {
        const id = Number.isSafeInteger(item?.id) ? item.id : null;
        const title = normalizeString(item?.title ?? item?.name);
        if (!id) {
          return null;
        }

        return {
          tmdbId: id,
          title: title ?? 'Unknown title',
          posterPath: typeof item?.poster_path === 'string' ? item.poster_path : null,
        };
      })
      .filter(Boolean)
    : [];

  return {
    tmdbId,
    title: movie.title,
    originalTitle: normalizeString(movie.original_title) ?? movie.title,
    overview: normalizeString(movie.overview),
    releaseDate,
    posterPath: typeof movie.poster_path === 'string' ? movie.poster_path : null,
    backdropPath: typeof movie.backdrop_path === 'string' ? movie.backdrop_path : null,
    voteAverage: resolveRating(movie.vote_average),
    voteCount: isNonNegativeSafeInteger(movie.vote_count) ? movie.vote_count : 0,
    tagline: normalizeString(movie.tagline),
    runtime: Number.isSafeInteger(movie.runtime) ? movie.runtime : null,
    originalLanguage: normalizeString(movie.original_language),
    year: resolveYear(releaseDate),
    genre: genres.length > 0 ? genres.join(' · ') : null,
    genres: normalizedGenres,
    rating: resolveRating(movie.vote_average),
    country: country.length > 0 ? country : language,
    director: crew.find((person) => /^director$/i.test(String(person?.job ?? '').trim()))?.name ?? null,
    writers: normalizeCrewNames(crew, [/writer/i, /screenplay/i, /story/i, /novel/i, /author/i, /characters/i]),
    producers: normalizeCrewNames(crew, [/producer/i, /executive producer/i, /associate producer/i, /co-producer/i, /line producer/i]),
    cinematographer: crew.find((person) => /director of photography|cinematographer/i.test(String(person?.job ?? '').trim()))?.name ?? null,
    productionCompanies: normalizedCompanies,
    budget: Number.isSafeInteger(movie.budget) ? movie.budget : 0,
    revenue: Number.isSafeInteger(movie.revenue) ? movie.revenue : 0,
    cast: normalizeCastList(movie.credits?.cast),
    gallery: {
      posters: normalizeImageCollection(Array.isArray(images.posters) ? images.posters : []),
      backdrops: normalizeImageCollection(Array.isArray(images.backdrops) ? images.backdrops : []),
      logos: normalizeImageCollection(Array.isArray(images.logos) ? images.logos : []),
    },
    similarMovies,
    similarMovieIds: similarMovies.map((item) => Number(item.tmdbId)).filter(Number.isFinite),
  };
}

function normalizeStoredGenre(item) {
  const genre = item && typeof item === 'object' && item.genre ? item.genre : item;
  const id = Number.isSafeInteger(genre?.tmdbId)
    ? genre.tmdbId
    : Number.isSafeInteger(genre?.id)
      ? genre.id
      : null;
  const name = normalizeString(genre?.name);

  if (id === null || !name) {
    return null;
  }

  return { id, name };
}

function normalizeStoredCast(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const id = Number.isSafeInteger(item.tmdbPersonId)
    ? item.tmdbPersonId
    : Number.isSafeInteger(item.id)
      ? item.id
      : null;
  const name = normalizeString(item.name);

  if (!name && id === null) {
    return null;
  }

  return {
    id,
    name,
    character: normalizeString(item.character) ?? null,
    profileUrl: normalizeTmdbImageUrl(item.profilePath ?? item.profile_path ?? item.profileUrl),
  };
}

function normalizeStoredGallery(entries) {
  const gallery = { posters: [], backdrops: [], logos: [] };

  if (!Array.isArray(entries)) {
    return gallery;
  }

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const rawPath = normalizeTmdbImageUrl(entry.imagePath ?? entry.image_path ?? entry.url ?? entry.path);
    if (!rawPath) {
      continue;
    }

    const type = String(entry.type ?? '').toLowerCase();
    if (type === 'poster') {
      gallery.posters.push(rawPath);
    } else if (type === 'backdrop') {
      gallery.backdrops.push(rawPath);
    } else if (type === 'logo') {
      gallery.logos.push(rawPath);
    }
  }

  return gallery;
}

function normalizeStoredProductionCompany(item) {
  const company = item && typeof item === 'object' && item.productionCompany ? item.productionCompany : item;
  const id = Number.isSafeInteger(company?.id)
    ? company.id
    : Number.isSafeInteger(company?.tmdbId)
      ? company.tmdbId
      : null;
  const name = normalizeString(company?.name);

  if (id === null || !name) {
    return null;
  }

  return {
    id,
    name,
    logoPath: normalizeTmdbImageUrl(company?.logoPath ?? company?.logo_path ?? company?.logoUrl),
  };
}

function normalizeStoredSimilarMovie(item) {
  const id = Number.isSafeInteger(item?.tmdbId)
    ? item.tmdbId
    : Number.isSafeInteger(item?.id)
      ? item.id
      : null;
  const title = normalizeString(item?.title ?? item?.name);
  if (id === null) {
    return null;
  }

  return {
    id,
    title: title ?? 'Unknown title',
    poster: normalizeTmdbImageUrl(item?.poster ?? item?.posterPath ?? item?.poster_path ?? item?.posterUrl),
  };
}

function toMovieDto(movie) {
  const poster = normalizeTmdbImageUrl(movie.poster ?? movie.posterPath);
  const backdrop = normalizeTmdbImageUrl(movie.backdrop ?? movie.backdropPath);
  const releaseDate = normalizeString(movie.releaseDate ?? movie.release_date);
  const year = Number.isInteger(movie.year) ? movie.year : resolveYear(releaseDate);
  const rating = Number.isFinite(movie.rating)
    ? movie.rating
    : resolveRating(movie.voteAverage);
  const genres = Array.isArray(movie.genres)
    ? movie.genres.map(normalizeStoredGenre).filter(Boolean)
    : [];
  const cast = Array.isArray(movie.casts)
    ? movie.casts.map(normalizeStoredCast).filter(Boolean)
    : Array.isArray(movie.cast)
      ? movie.cast
      : [];
  const gallery = movie.gallery && typeof movie.gallery === 'object'
    ? movie.gallery
    : normalizeStoredGallery(Array.isArray(movie.galleries) ? movie.galleries : []);
  const similarMovies = Array.isArray(movie.similarMovies)
    ? movie.similarMovies.map(normalizeStoredSimilarMovie).filter(Boolean)
    : Array.isArray(movie.similarMovieIds)
      ? movie.similarMovieIds.map((id) => ({ id: Number(id), title: null, poster: null })).filter((item) => Number.isFinite(item.id))
      : [];
  const similarMovieIds = similarMovies.map((item) => Number(item.id)).filter(Number.isFinite);
  const productionCompanies = Array.isArray(movie.productionCompanies)
    ? movie.productionCompanies.map(normalizeStoredProductionCompany).filter(Boolean)
    : Array.isArray(movie.production_companies)
      ? movie.production_companies.map(normalizeStoredProductionCompany).filter(Boolean)
      : [];

  logger.debug({
    tmdbId: movie.tmdbId ?? movie.id ?? 'unknown',
    rawTagline: movie.tagline,
    normalizedTagline: normalizeString(movie.tagline) ?? null,
  }, 'Movie tagline normalization');

  return {
    id: movie.tmdbId ?? movie.id ?? null,
    tmdbId: movie.tmdbId ?? movie.id ?? null,
    title: movie.title,
    originalTitle: normalizeString(movie.originalTitle) ?? movie.title,
    year,
    genre: normalizeString(movie.genre) ?? (genres.length > 0 ? genres.map((entry) => entry.name).join(' · ') : null),
    rating,
    poster,
    backdrop,
    description: normalizeString(movie.description) ?? normalizeString(movie.overview),
    tagline: normalizeString(movie.tagline) ?? null,
    runtime: Number.isInteger(movie.runtime) ? movie.runtime : null,
    releaseDate,
    originalLanguage: normalizeString(movie.originalLanguage) ?? null,
    country: Array.isArray(movie.country) ? movie.country : [],
    director: normalizeString(movie.director) ?? null,
    writers: Array.isArray(movie.writers) ? movie.writers : [],
    producers: Array.isArray(movie.producers) ? movie.producers : [],
    cinematographer: normalizeString(movie.cinematographer) ?? null,
    productionCompanies,
    budget: Number.isSafeInteger(movie.budget) ? movie.budget : 0,
    revenue: Number.isSafeInteger(movie.revenue) ? movie.revenue : 0,
    cast,
    gallery,
    similarMovies,
    similarMovieIds,
    overview: normalizeString(movie.overview) ?? null,
    posterPath: movie.posterPath ?? (typeof poster === 'string' ? poster : null),
    backdropPath: movie.backdropPath ?? (typeof backdrop === 'string' ? backdrop : null),
    voteAverage: Number.isFinite(movie.voteAverage) ? movie.voteAverage : rating,
    voteCount: Number.isSafeInteger(movie.voteCount) ? movie.voteCount : 0,
    genres,
  };
}

function toAppError(error) {
  return new AppError(error.message, {
    statusCode: error.statusCode,
    code: error.code,
  });
}

/**
 * @param {{ tmdbClient: ReturnType<import('../integrations/tmdb/tmdbClient.js').createTmdbClient>, movieRepository: ReturnType<import('../repositories/movieRepository.js').createMovieRepository> }} dependencies
 */
export function createMovieService({ tmdbClient, movieRepository }) {
  return Object.freeze({
    async searchMovies({ query, page }) {
      logger.info(`Searching movies from TMDB: query="${query}", page=${page}`);
      let response;
      try {
        response = await tmdbClient.searchMovies(query, page);
      } catch (error) {
        logger.error({ err: error, query, page }, 'TMDB movie search failed');
        if (error instanceof TmdbClientError) {
          throw toAppError(error);
        }

        throw error;
      }

      if (!Array.isArray(response.results)
        || !Number.isSafeInteger(response.page)
        || response.page < 1
        || !isNonNegativeSafeInteger(response.total_pages)
        || !isNonNegativeSafeInteger(response.total_results)) {
        logger.error({ response }, 'TMDB movie search response was invalid');
        throw invalidTmdbResponse();
      }

      logger.info(`TMDB movie search succeeded: query="${query}", page=${page}, totalResults=${response.total_results}`);
      return {
        movies: response.results.map(toMovieSummary),
        page: response.page,
        totalPages: response.total_pages,
        totalResults: response.total_results,
      };
    },

    async getPopularMovies(page = 1) {
      logger.info(`Fetching popular movies from TMDB: page=${page}`);
      let response;
      try {
        response = await tmdbClient.getPopularMovies(page);
      } catch (error) {
        logger.error({ err: error, page }, 'TMDB popular movies request failed');
        if (error instanceof TmdbClientError) {
          throw toAppError(error);
        }

        throw error;
      }

      if (!Array.isArray(response.results)
        || !Number.isSafeInteger(response.page)
        || response.page < 1
        || !isNonNegativeSafeInteger(response.total_pages)
        || !isNonNegativeSafeInteger(response.total_results)) {
        logger.error({ response }, 'TMDB popular movies response was invalid');
        throw invalidTmdbResponse();
      }

      logger.info(`TMDB popular movies loaded: page=${response.page}, totalResults=${response.total_results}`);
      return {
        movies: response.results.map(toMovieSummary),
        page: response.page,
        totalPages: response.total_pages,
        totalResults: response.total_results,
      };
    },

    async getMovieDetails(tmdbId) {
      logger.info(`Loading movie details for tmdbId=${tmdbId}`);
      const cachedMovie = await movieRepository.findDetailedByTmdbId(tmdbId)
        ?? await movieRepository.findByTmdbId(tmdbId);
      const now = new Date();
      const cacheTtlMs = env.tmdbCacheTtlDays * DAY_IN_MS;
      if (cachedMovie && now.getTime() - cachedMovie.lastSyncedAt.getTime() < cacheTtlMs) {
        logger.info(`Returning fresh cached movie details for tmdbId=${tmdbId}`);
        return toMovieDto(cachedMovie);
      }

      if (cachedMovie) {
        logger.info(`Movie cache for tmdbId=${tmdbId} is stale; refreshing from TMDB`);
      } else {
        logger.info(`Movie details for tmdbId=${tmdbId} not found in cache; fetching from TMDB`);
      }

      let refreshedDetails;
      try {
        const tmdbMovie = await tmdbClient.getMovieDetails(tmdbId);
        refreshedDetails = toMovieRecord(tmdbMovie, tmdbId);
      } catch (error) {
        if (cachedMovie && error instanceof TmdbClientError) {
          logger.warn({ err: error, tmdbId }, 'TMDB refresh failed; serving stale cached movie details');
          return toMovieDto(cachedMovie);
        }
        logger.error({ err: error, tmdbId }, 'TMDB movie detail refresh failed without cache fallback');
        if (error instanceof TmdbClientError) {
          throw toAppError(error);
        }

        throw error;
      }

      const savedMovie = await movieRepository.upsertByTmdbId(tmdbId, {
        ...refreshedDetails,
        lastSyncedAt: now,
      });

      await movieRepository.syncRelations(tmdbId, {
        genres: Array.isArray(refreshedDetails.genres)
          ? refreshedDetails.genres.map((genre) => ({ tmdbId: genre.tmdbId, name: genre.name }))
          : [],
        casts: Array.isArray(refreshedDetails.cast)
          ? refreshedDetails.cast.map((person) => ({
              tmdbPersonId: Number(person.id),
              name: person.name,
              character: person.character,
              profilePath: person.profileUrl,
            }))
          : [],
        galleries: [
          ...((Array.isArray(refreshedDetails.gallery?.posters) ? refreshedDetails.gallery.posters : []).map((imagePath) => ({ type: 'poster', imagePath }))),
          ...((Array.isArray(refreshedDetails.gallery?.backdrops) ? refreshedDetails.gallery.backdrops : []).map((imagePath) => ({ type: 'backdrop', imagePath }))),
          ...((Array.isArray(refreshedDetails.gallery?.logos) ? refreshedDetails.gallery.logos : []).map((imagePath) => ({ type: 'logo', imagePath }))),
        ],
        similarMovies: Array.isArray(refreshedDetails.similarMovies)
          ? refreshedDetails.similarMovies.map((movie) => ({
              tmdbId: Number(movie.tmdbId ?? movie.id),
              title: movie.title,
              posterPath: movie.posterPath ?? movie.poster ?? null,
            })).filter((movie) => Number.isFinite(movie.tmdbId) && movie.tmdbId > 0)
          : [],
        productionCompanies: Array.isArray(refreshedDetails.productionCompanies)
          ? refreshedDetails.productionCompanies.map((company) => ({
              id: Number(company.id),
              name: company.name,
              logoPath: company.logoPath,
            }))
          : [],
      });

      logger.info(`Movie details saved for tmdbId=${tmdbId}`);
      return toMovieDto({ ...savedMovie, ...refreshedDetails, lastSyncedAt: now });
    },
  });
}
