import { env } from '../config/env.js';
import { prisma } from '../core/database/prisma.js';
import { movieService } from './movieModule.js';
import { createRecommendationController } from '../controllers/recommendationController.js';
import { createRecommendationRepository } from '../repositories/recommendationRepository.js';
import { createRecommendationRoutes } from '../routes/recommendationRoutes.js';
import { createRecommendationService } from '../services/recommendationService.js';

const recommendationRepository = createRecommendationRepository(prisma);
const recommendationService = createRecommendationService({
  recommendationRepository,
  movieService,
  limit: env.mostWatchedLimit,
  minimumRecords: env.mostWatchedMinRecords,
});
const recommendationController = createRecommendationController(recommendationService);

export const recommendationRoutes = createRecommendationRoutes(recommendationController);
