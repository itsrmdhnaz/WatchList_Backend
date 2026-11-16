import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import {
  validateProfileMoviesQuery,
  validatePublicId,
} from '../validators/profileValidators.js';

/** @param {ReturnType<import('../controllers/profileController.js').createProfileController>} controller */
export function createProfileRoutes(controller) {
  const router = Router();
  router.get('/:publicId/movies', requireAuth, validatePublicId, validateProfileMoviesQuery, controller.getMovies);
  router.get('/:publicId', requireAuth, validatePublicId, controller.getProfile);
  router.patch('/:publicId/visibility', requireAuth, validatePublicId, controller.updateVisibility);
  return router;
}
