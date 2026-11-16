/**
 * @param {{ recommendationRepository: ReturnType<import('../repositories/recommendationRepository.js').createRecommendationRepository>, movieService: ReturnType<import('../services/movieService.js').createMovieService>, limit: number, minimumRecords: number }} dependencies
 */
export function createRecommendationService({
  recommendationRepository,
  movieService,
  limit,
  minimumRecords,
}) {
  return Object.freeze({
    async getMostWatched() {
      const local = await recommendationRepository.getMostWatched(limit);
      const localMovies = Array.isArray(local.movies) ? local.movies : [];

      if (localMovies.length === 0) {
        const popular = await movieService.getPopularMovies(1);
        return {
          movies: Array.isArray(popular.movies) ? popular.movies.slice(0, limit) : [],
          source: 'tmdb_popular',
        };
      }

      const remainingSlots = Math.max(0, limit - localMovies.length);
      if (remainingSlots === 0 || local.watchedRecords >= minimumRecords) {
        return {
          movies: localMovies.slice(0, limit),
          source: 'local_most_watched',
        };
      }

      const popular = await movieService.getPopularMovies(1);
      const popularMovies = Array.isArray(popular.movies) ? popular.movies : [];
      const seenTmdbIds = new Set(localMovies
        .map((movie) => movie.tmdbId ?? movie.id)
        .filter((value) => Number.isFinite(Number(value))));

      const fillerMovies = popularMovies.filter((movie) => {
        const tmdbId = movie.tmdbId ?? movie.id;
        return !seenTmdbIds.has(Number(tmdbId));
      }).slice(0, remainingSlots);

      return {
        movies: [...localMovies.slice(0, limit), ...fillerMovies],
        source: 'local_most_watched',
      };
    },
  });
}
