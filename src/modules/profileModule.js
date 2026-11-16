import { prisma } from '../core/database/prisma.js';
import { createProfileController } from '../controllers/profileController.js';
import { createProfileRepository } from '../repositories/profileRepository.js';
import { createProfileRoutes } from '../routes/profileRoutes.js';
import { createProfileService } from '../services/profileService.js';

const profileRepository = createProfileRepository(prisma);
const profileService = createProfileService({ profileRepository });
const profileController = createProfileController(profileService);

export const profileRoutes = createProfileRoutes(profileController);
