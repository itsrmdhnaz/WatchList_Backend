import { env } from '../config/env.js';
import AppError from '../core/errors/AppError.js';
import Response from '../core/response/Response.js';
import { createAccessToken } from '../services/accessTokenService.js';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth';
const REFRESH_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: REFRESH_COOKIE_PATH,
});

function setNoStoreHeaders(res) {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
}

/**
 * @param {{ authService: ReturnType<import('../services/authService.js').createAuthService>, refreshTokenService: ReturnType<import('../services/refreshTokenService.js').createRefreshTokenService> }} dependencies
 */
export function createAuthController({ authService, refreshTokenService }) {
  return Object.freeze({
    async currentUser(req, res) {
      const result = await authService.getCurrentUser(req.auth.userId);
      setNoStoreHeaders(res);
      return res.status(200).json(
        Response.success(result, { message: 'Current user loaded successfully.' }),
      );
    },

    async register(req, res) {
      const result = await authService.register(req.authInput);
      return res.status(201).json(
        Response.success(result, { message: 'Account created successfully.' }),
      );
    },

    async login(req, res) {
      const result = await authService.login(req.authInput);

      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
        ...REFRESH_COOKIE_OPTIONS,
        expires: result.refreshTokenExpiresAt,
      });
      setNoStoreHeaders(res);

      return res.status(200).json(Response.success({
        user: result.user,
        accessToken: result.accessToken,
      }, { message: 'Login successful.' }));
    },

    async refresh(req, res) {
      const session = await refreshTokenService.rotate(req.cookies?.[REFRESH_COOKIE_NAME]);
      if (!session) {
        clearRefreshCookie(res);
        throw new AppError('Refresh session is invalid or expired.', {
          statusCode: 401,
          code: 'INVALID_REFRESH_TOKEN',
        });
      }

      const accessToken = await createAccessToken(session.userId);
      res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
        ...REFRESH_COOKIE_OPTIONS,
        expires: session.expiresAt,
      });
      setNoStoreHeaders(res);

      return res.status(200).json(
        Response.success({ accessToken }, { message: 'Token refreshed successfully.' }),
      );
    },

    async logout(req, res) {
      await refreshTokenService.revoke(req.cookies?.[REFRESH_COOKIE_NAME]);
      clearRefreshCookie(res);
      setNoStoreHeaders(res);

      return res.status(200).json(
        Response.success({}, { message: 'Logged out successfully.' }),
      );
    },
  });
}
