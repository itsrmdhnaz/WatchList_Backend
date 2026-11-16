import { Router } from 'express';
import { authRateLimiter } from '../middlewares/authRateLimiter.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireTrustedOrigin } from '../middlewares/requireTrustedOrigin.js';
import { validateLogin, validateRegistration } from '../validators/authValidators.js';

/** @param {ReturnType<import('../controllers/authController.js').createAuthController>} controller */
export function createAuthRoutes(controller) {
  const router = Router();

  router.get('/current-user', requireAuth, controller.currentUser);
  router.post('/register', requireTrustedOrigin, authRateLimiter, validateRegistration, controller.register);
  router.post('/login', requireTrustedOrigin, authRateLimiter, validateLogin, controller.login);
  router.post('/refresh', requireTrustedOrigin, authRateLimiter, controller.refresh);
  router.post('/logout', requireTrustedOrigin, controller.logout);

  return router;
}
