import { prisma } from '../core/database/prisma.js';
import { createAuthController } from '../controllers/authController.js';
import { createRefreshTokenRepository } from '../repositories/refreshTokenRepository.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { createAuthRoutes } from '../routes/authRoutes.js';
import { createAuthService } from '../services/authService.js';
import { createRefreshTokenService } from '../services/refreshTokenService.js';

const userRepository = createUserRepository(prisma);
const refreshTokenRepository = createRefreshTokenRepository(prisma);
const refreshTokenService = createRefreshTokenService(refreshTokenRepository);
const authService = createAuthService({ userRepository, refreshTokenService });
const authController = createAuthController({ authService, refreshTokenService });

export const authRoutes = createAuthRoutes(authController);
