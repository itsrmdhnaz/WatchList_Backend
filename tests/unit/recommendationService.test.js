import { describe, expect, it, vi } from 'vitest';
import { createRecommendationService } from '../../src/services/recommendationService.js';

describe('Most Watched recommendation service', () => {
  it('uses local rankings once the watched-record threshold is reached', async () => {
    const recommendationRepository = {
      getMostWatched: vi.fn().mockResolvedValue({
        watchedRecords: 10,
        movies: [{ tmdbId: 42, title: 'Locally Watched', watchedCount: 10 }],
      }),
    };
    const movieService = { getPopularMovies: vi.fn() };
    const service = createRecommendationService({
      recommendationRepository,
      movieService,
      limit: 20,
      minimumRecords: 10,
    });

    await expect(service.getMostWatched()).resolves.toEqual({
      movies: [{ tmdbId: 42, title: 'Locally Watched', watchedCount: 10 }],
      source: 'local_most_watched',
    });
    expect(movieService.getPopularMovies).not.toHaveBeenCalled();
  });

  it('fills the remaining slots with TMDB Popular movies when local rankings are below the threshold', async () => {
    const recommendationRepository = {
      getMostWatched: vi.fn().mockResolvedValue({
        watchedRecords: 9,
        movies: [{ tmdbId: 42, title: 'Local Rank', watchedCount: 9 }],
      }),
    };
    const popularMovies = [
      { tmdbId: 42, title: 'Duplicate Local Movie' },
      { tmdbId: 550, title: 'Popular Movie A' },
      { tmdbId: 551, title: 'Popular Movie B' },
    ];
    const movieService = {
      getPopularMovies: vi.fn().mockResolvedValue({ movies: popularMovies }),
    };
    const service = createRecommendationService({
      recommendationRepository,
      movieService,
      limit: 3,
      minimumRecords: 10,
    });

    await expect(service.getMostWatched()).resolves.toEqual({
      movies: [
        { tmdbId: 42, title: 'Local Rank', watchedCount: 9 },
        { tmdbId: 550, title: 'Popular Movie A' },
        { tmdbId: 551, title: 'Popular Movie B' },
      ],
      source: 'local_most_watched',
    });
    expect(movieService.getPopularMovies).toHaveBeenCalledWith(1);
  });
});
