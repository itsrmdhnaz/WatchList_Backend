import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppError from '../../src/core/errors/AppError.js';
import { TmdbClientError } from '../../src/integrations/tmdb/tmdbClient.js';
import { createMovieService } from '../../src/services/movieService.js';

const tmdbId = 42;

function cachedMovie(lastSyncedAt = new Date()) {
  return {
    tmdbId,
    title: 'Cached Movie',
    overview: 'Cached overview',
    releaseDate: '2020-01-01',
    posterPath: '/poster.jpg',
    backdropPath: '/backdrop.jpg',
    voteAverage: 8,
    voteCount: 120,
    lastSyncedAt,
  };
}

function tmdbDetails(title = 'Fresh Movie') {
  return {
    id: tmdbId,
    title,
    overview: 'Fresh overview',
    release_date: '2024-01-01',
    poster_path: '/fresh-poster.jpg',
    backdrop_path: '/fresh-backdrop.jpg',
    vote_average: 7.5,
    vote_count: 250,
  };
}

describe('movie detail cache service', () => {
  let tmdbClient;
  let movieRepository;
  let service;

  beforeEach(() => {
    tmdbClient = {
      getMovieDetails: vi.fn(),
      getPopularMovies: vi.fn(),
    };
    movieRepository = {
      findByTmdbId: vi.fn(),
      upsertByTmdbId: vi.fn(),
    };
    service = createMovieService({ tmdbClient, movieRepository });
  });

  it('returns fresh cached details without calling TMDB', async () => {
    movieRepository.findByTmdbId.mockResolvedValue(cachedMovie());

    const result = await service.getMovieDetails(tmdbId);

    expect(result).toMatchObject({ tmdbId, title: 'Cached Movie' });
    expect(result).not.toHaveProperty('id');
    expect(tmdbClient.getMovieDetails).not.toHaveBeenCalled();
    expect(movieRepository.upsertByTmdbId).not.toHaveBeenCalled();
  });

  it('loads and caches details when no local row exists', async () => {
    movieRepository.findByTmdbId.mockResolvedValue(null);
    tmdbClient.getMovieDetails.mockResolvedValue(tmdbDetails());
    movieRepository.upsertByTmdbId.mockImplementation(async (id, data) => ({
      tmdbId: id,
      ...data,
    }));

    const result = await service.getMovieDetails(tmdbId);

    expect(movieRepository.upsertByTmdbId).toHaveBeenCalledWith(
      tmdbId,
      expect.objectContaining({ title: 'Fresh Movie', voteCount: 250 }),
    );
    expect(result).toMatchObject({ tmdbId, title: 'Fresh Movie' });
  });

  it('refreshes stale cache data from TMDB', async () => {
    movieRepository.findByTmdbId.mockResolvedValue(
      cachedMovie(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)),
    );
    tmdbClient.getMovieDetails.mockResolvedValue(tmdbDetails('Refreshed Movie'));
    movieRepository.upsertByTmdbId.mockImplementation(async (id, data) => ({
      tmdbId: id,
      ...data,
    }));

    const result = await service.getMovieDetails(tmdbId);

    expect(tmdbClient.getMovieDetails).toHaveBeenCalledWith(tmdbId);
    expect(result.title).toBe('Refreshed Movie');
  });

  it('serves stale cache when the TMDB request fails', async () => {
    movieRepository.findByTmdbId.mockResolvedValue(
      cachedMovie(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)),
    );
    tmdbClient.getMovieDetails.mockRejectedValue(new TmdbClientError('Provider unavailable', {
      statusCode: 503,
      code: 'TMDB_UNAVAILABLE',
    }));

    const result = await service.getMovieDetails(tmdbId);

    expect(result.title).toBe('Cached Movie');
    expect(movieRepository.upsertByTmdbId).not.toHaveBeenCalled();
  });

  it('maps a TMDB failure to an AppError when there is no cache fallback', async () => {
    movieRepository.findByTmdbId.mockResolvedValue(null);
    tmdbClient.getMovieDetails.mockRejectedValue(new TmdbClientError('Provider unavailable', {
      statusCode: 503,
      code: 'TMDB_UNAVAILABLE',
    }));

    let error;
    try {
      await service.getMovieDetails(tmdbId);
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ statusCode: 503, code: 'TMDB_UNAVAILABLE' });
  });

  it('maps TMDB Popular results to the standard public movie summary', async () => {
    tmdbClient.getPopularMovies.mockResolvedValue({
      page: 1,
      total_pages: 3,
      total_results: 45,
      results: [tmdbDetails('Popular Movie')],
    });

    const result = await service.getPopularMovies(1);

    expect(result).toEqual({
      movies: [expect.objectContaining({ tmdbId, title: 'Popular Movie' })],
      page: 1,
      totalPages: 3,
      totalResults: 45,
    });
    expect(result.movies[0]).not.toHaveProperty('id');
    expect(tmdbClient.getPopularMovies).toHaveBeenCalledWith(1);
  });

  it('returns a detail payload assembled from normalized relational data', async () => {
    movieRepository.findByTmdbId.mockResolvedValue({
      tmdbId,
      title: 'Normalized Movie',
      overview: 'A good example',
      releaseDate: '2024-01-01',
      posterPath: '/poster.jpg',
      backdropPath: '/backdrop.jpg',
      voteAverage: 8.4,
      voteCount: 200,
      lastSyncedAt: new Date(),
      genres: [
        { genre: { tmdbId: 18, name: 'Drama' } },
        { genre: { tmdbId: 28, name: 'Action' } },
      ],
      casts: [
        { tmdbPersonId: 1001, name: 'Actor One', character: 'Hero', profilePath: '/actor.jpg' },
      ],
      galleries: [
        { type: 'poster', imagePath: '/poster-1.jpg' },
        { type: 'backdrop', imagePath: '/backdrop-1.jpg' },
      ],
      similarMovies: [{ tmdbId: 999 }],
      productionCompanies: [{ productionCompany: { id: 10, name: 'Studio X', logoPath: '/logo.png' } }],
    });

    const result = await service.getMovieDetails(tmdbId);

    expect(result).toMatchObject({
      tmdbId,
      title: 'Normalized Movie',
      genre: 'Drama · Action',
      genres: [{ id: 18, name: 'Drama' }, { id: 28, name: 'Action' }],
      cast: [{ id: 1001, name: 'Actor One', character: 'Hero', profileUrl: 'https://image.tmdb.org/t/p/original/actor.jpg' }],
      gallery: { posters: ['https://image.tmdb.org/t/p/original/poster-1.jpg'], backdrops: ['https://image.tmdb.org/t/p/original/backdrop-1.jpg'], logos: [] },
      similarMovieIds: [999],
      productionCompanies: [{ id: 10, name: 'Studio X', logoPath: 'https://image.tmdb.org/t/p/original/logo.png' }],
    });
  });
});
