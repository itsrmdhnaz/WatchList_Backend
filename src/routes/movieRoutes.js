import { Router } from 'express';
import { validateMovieSearch, validateTmdbId } from '../validators/movieValidators.js';

/** @param {ReturnType<import('../controllers/movieController.js').createMovieController>} controller */
export function createMovieRoutes(controller) {
  const router = Router();
  router.get('/search', validateMovieSearch, controller.search);
  router.get('/:tmdbId', validateTmdbId, controller.details);
  return router;
}
