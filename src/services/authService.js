import { randomBytes, randomUUID } from 'node:crypto';
import AppError from '../core/errors/AppError.js';
import { createAccessToken } from './accessTokenService.js';
import { hashPassword, verifyPassword } from './passwordService.js';

let dummyPasswordHashPromise;

function getDummyPasswordHash() {
  dummyPasswordHashPromise ??= hashPassword(randomBytes(32).toString('hex'));
  return dummyPasswordHashPromise;
}

function toPublicUser(user) {
  return {
    publicId: user.publicId,
    email: user.email,
    displayName: user.displayName,
  };
}

/**
 * Creates authentication business operations.
 *
 * @param {{ userRepository: ReturnType<import('../repositories/userRepository.js').createUserRepository>, refreshTokenService: ReturnType<import('./refreshTokenService.js').createRefreshTokenService> }} dependencies
 */
export function createAuthService({ userRepository, refreshTokenService }) {
  return Object.freeze({
    async getCurrentUser(userId) {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new AppError('Authentication is required.', {
          statusCode: 401,
          code: 'UNAUTHORIZED',
        });
      }

      return { user: toPublicUser(user) };
    },

    async register({ email, password, displayName }) {
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await userRepository.findByEmail(normalizedEmail);
      if (existingUser) {
        throw new AppError('Email is already registered.', {
          statusCode: 409,
          code: 'EMAIL_ALREADY_EXISTS',
        });
      }

      const passwordHash = await hashPassword(password);
      let user;
      try {
        user = await userRepository.create({
          email: normalizedEmail,
          password: passwordHash,
          displayName: displayName.trim(),
          publicId: randomUUID(),
        });
      } catch (error) {
        if (error?.code === 'P2002') {
          throw new AppError('Email is already registered.', {
            statusCode: 409,
            code: 'EMAIL_ALREADY_EXISTS',
          });
        }

        throw error;
      }

      return { user: toPublicUser(user) };
    },

    async login({ email, password, rememberMe = false }) {
      const normalizedEmail = email.trim().toLowerCase();
      const user = await userRepository.findByEmail(normalizedEmail);
      const passwordHash = user?.password ?? await getDummyPasswordHash();
      const passwordMatches = await verifyPassword(password, passwordHash);

      if (!user || !passwordMatches) {
        throw new AppError('Invalid email or password.', {
          statusCode: 401,
          code: 'INVALID_CREDENTIALS',
        });
      }

      const accessToken = await createAccessToken(user.id);
      const refreshSession = await refreshTokenService.createSession(user.id, { rememberMe });

      return {
        user: toPublicUser(user),
        accessToken,
        refreshToken: refreshSession.refreshToken,
        refreshTokenExpiresAt: refreshSession.expiresAt,
      };
    },
  });
}
