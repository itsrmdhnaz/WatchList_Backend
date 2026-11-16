import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

import { env } from '../src/config/env.js';
import { createTmdbClient } from '../src/integrations/tmdb/tmdbClient.js';
import { createMovieRepository } from '../src/repositories/movieRepository.js';
import { createMovieService } from '../src/services/movieService.js';

const seedCount = Number.parseInt(process.env.SEED_MOVIE_COUNT ?? '10', 10);
const safeSeedCount = Number.isFinite(seedCount) && seedCount > 0 ? seedCount : 10;

const databaseDir = dirname(env.databasePath);
mkdirSync(databaseDir, { recursive: true });

const adapter = new PrismaBetterSqlite3({ url: env.databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  if (!env.tmdbApiKey) {
    throw new Error('TMDB_API_KEY is not configured. Set it before running the movie seeder.');
  }

  const tmdbClient = createTmdbClient();
  const movieRepository = createMovieRepository(prisma);
  const movieService = createMovieService({ tmdbClient, movieRepository });

  const popularResponse = await tmdbClient.getPopularMovies(1);
  const tmdbIds = popularResponse.results
    .slice(0, safeSeedCount)
    .map((movie) => Number(movie.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (tmdbIds.length === 0) {
    throw new Error('No TMDB movie IDs were returned for seeding.');
  }

  for (const tmdbId of tmdbIds) {
    await movieService.getMovieDetails(tmdbId);
  }

  const seededCount = await prisma.movie.count();
  console.log(`Seeded ${tmdbIds.length} TMDB movies into the local catalog. Total movies: ${seededCount}`);
}

try {
  await main();
} catch (error) {
  console.error('Movie seeder failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
