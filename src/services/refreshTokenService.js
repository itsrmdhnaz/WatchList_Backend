import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createOpaqueRefreshToken() {
  return randomBytes(32).toString('base64url');
}

function assertUserId(userId) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TypeError('userId must be a positive safe integer.');
  }
}

/**
 * Creates refresh-token session operations. Only token hashes are persisted.
 *
 * @param {ReturnType<import('../repositories/refreshTokenRepository.js').createRefreshTokenRepository>} repository
 */
export function createRefreshTokenService(repository) {
  return Object.freeze({
    async createSession(userId, { rememberMe = false } = {}) {
      assertUserId(userId);
      if (typeof rememberMe !== 'boolean') {
        throw new TypeError('rememberMe must be a boolean.');
      }

      const refreshToken = createOpaqueRefreshToken();
      const createdAt = new Date();
      const ttlDays = rememberMe
        ? env.refreshTokenTtlRememberDays
        : env.refreshTokenTtlDefaultDays;
      const expiresAt = new Date(createdAt.getTime() + ttlDays * DAY_IN_MS);

      await repository.create({
        userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt,
      });

      return { userId, refreshToken, expiresAt };
    },

    async rotate(presentedToken) {
      if (typeof presentedToken !== 'string' || presentedToken.length === 0) {
        return null;
      }

      const now = new Date();
      const currentHash = hashRefreshToken(presentedToken);
      const current = await repository.findByTokenHash(currentHash);

      if (!current || current.expiresAt <= now) {
        return null;
      }

      if (current.revokedAt) {
        await repository.revokeAllActiveByUserId(current.userId, now);
        return null;
      }

      const refreshToken = createOpaqueRefreshToken();
      const rotated = await repository.rotate({
        userId: current.userId,
        tokenHash: currentHash,
        revokedAt: now,
        successor: {
          userId: current.userId,
          tokenHash: hashRefreshToken(refreshToken),
          expiresAt: current.expiresAt,
        },
      });

      if (!rotated) {
        return null;
      }

      return {
        userId: current.userId,
        refreshToken,
        expiresAt: current.expiresAt,
      };
    },

    async revoke(presentedToken) {
      if (typeof presentedToken !== 'string' || presentedToken.length === 0) {
        return false;
      }

      const now = new Date();
      const tokenHash = hashRefreshToken(presentedToken);
      const current = await repository.findByTokenHash(tokenHash);

      if (!current) {
        return false;
      }

      if (current.revokedAt && current.expiresAt > now) {
        await repository.revokeAllActiveByUserId(current.userId, now);
        return true;
      }

      return repository.revokeByTokenHash(tokenHash, now);
    },
  });
}
