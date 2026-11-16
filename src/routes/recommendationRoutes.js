import { Router } from 'express';

/** @param {ReturnType<import('../controllers/recommendationController.js').createRecommendationController>} controller */
export function createRecommendationRoutes(controller) {
  const router = Router();
  router.get('/most-watched', controller.mostWatched);
  return router;
}
