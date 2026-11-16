import { prisma } from '../core/database/prisma.js';
import { createMovieController } from '../controllers/movieController.js';
import { createMovieRepository } from '../repositories/movieRepository.js';
import { createMovieRoutes } from '../routes/movieRoutes.js';
import { createMovieService } from '../services/movieService.js';
import { createTmdbClient } from '../integrations/tmdb/tmdbClient.js';

const tmdbClient = createTmdbClient();
const movieRepository = createMovieRepository(prisma);
export const movieService = createMovieService({ tmdbClient, movieRepository });
const movieController = createMovieController(movieService);

export const movieRoutes = createMovieRoutes(movieController);
