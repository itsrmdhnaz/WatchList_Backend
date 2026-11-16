import { prisma } from '../core/database/prisma.js';
import { createLibraryController } from '../controllers/libraryController.js';
import { createLibraryRepository } from '../repositories/libraryRepository.js';
import { createLibraryRoutes } from '../routes/libraryRoutes.js';
import { createLibraryService } from '../services/libraryService.js';
import { movieService } from './movieModule.js';

const libraryRepository = createLibraryRepository(prisma);
const libraryService = createLibraryService({ movieService, libraryRepository });
const libraryController = createLibraryController(libraryService);

export const libraryRoutes = createLibraryRoutes(libraryController);
