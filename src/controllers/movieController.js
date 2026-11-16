import Response from '../core/response/Response.js';

/** @param {ReturnType<import('../services/movieService.js').createMovieService>} movieService */
export function createMovieController(movieService) {
  return Object.freeze({
    async details(req, res) {
      const movie = await movieService.getMovieDetails(req.tmdbId);
      return res.status(200).json(
        Response.success(movie, { message: 'Movie details loaded successfully.' }),
      );
    },

    async search(req, res) {
      const result = await movieService.searchMovies(req.movieSearchInput);
      return res.status(200).json(Response.success(result.movies, {
        message: 'Movie search completed.',
        meta: {
          page: result.page,
          totalPages: result.totalPages,
          totalResults: result.totalResults,
        },
      }));
    },
  });
}
