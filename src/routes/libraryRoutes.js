import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import {
  validateAddLibraryEntry,
  validateLibraryTmdbId,
  validateListLibrary,
  validateUpdateLibraryEntry,
} from '../validators/libraryValidators.js';

/** @param {ReturnType<import('../controllers/libraryController.js').createLibraryController>} controller */
export function createLibraryRoutes(controller) {
  const router = Router();
  router.get('/stats', requireAuth, controller.stats);
  router.get('/', requireAuth, validateListLibrary, controller.list);
  router.post('/', requireAuth, validateAddLibraryEntry, controller.add);
  router.patch(
    '/:tmdbId',
    requireAuth,
    validateLibraryTmdbId,
    validateUpdateLibraryEntry,
    controller.update,
  );
  router.delete('/:tmdbId', requireAuth, validateLibraryTmdbId, controller.remove);
  return router;
}
