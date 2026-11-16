import Response from '../core/response/Response.js';

/** @param {ReturnType<import('../services/recommendationService.js').createRecommendationService>} recommendationService */
export function createRecommendationController(recommendationService) {
  return Object.freeze({
    async mostWatched(_req, res) {
      const result = await recommendationService.getMostWatched();
      return res.status(200).json(
        Response.success(result.movies, {
          message: 'Most-watched recommendations loaded successfully.',
          meta: { source: result.source },
        }),
      );
    },
  });
}
