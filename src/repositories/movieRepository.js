const MOVIE_PUBLIC_FIELDS = Object.freeze({
  tmdbId: true,
  title: true,
  originalTitle: true,
  overview: true,
  releaseDate: true,
  posterPath: true,
  backdropPath: true,
  voteAverage: true,
  voteCount: true,
  tagline: true,
  runtime: true,
  originalLanguage: true,
  year: true,
  rating: true,
  director: true,
  budget: true,
  revenue: true,
  lastSyncedAt: true,
});

function sanitizeMovieRecord(data) {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const movieRecord = {
    tmdbId: data.tmdbId,
    title: data.title,
    originalTitle: data.originalTitle,
    overview: data.overview,
    releaseDate: data.releaseDate,
    posterPath: data.posterPath,
    backdropPath: data.backdropPath,
    voteAverage: data.voteAverage,
    voteCount: data.voteCount,
    tagline: data.tagline,
    runtime: data.runtime,
    originalLanguage: data.originalLanguage,
    year: data.year,
    rating: data.rating,
    director: data.director,
    budget: data.budget,
    revenue: data.revenue,
    lastSyncedAt: data.lastSyncedAt,
  };

  return Object.fromEntries(
    Object.entries(movieRecord).filter(([, value]) => value !== undefined),
  );
}

/**
 * Creates persistence operations for cached TMDB movie details.
 *
 * @param {import('@prisma/client').PrismaClient} prismaClient
 */
export function createMovieRepository(prismaClient) {
  return Object.freeze({
    findByTmdbId(tmdbId) {
      return prismaClient.movie.findUnique({
        where: { tmdbId },
        select: MOVIE_PUBLIC_FIELDS,
      });
    },

    findDetailedByTmdbId(tmdbId) {
      return prismaClient.movie.findUnique({
        where: { tmdbId },
        select: {
          ...MOVIE_PUBLIC_FIELDS,
          genres: {
            select: {
              genre: {
                select: { tmdbId: true, name: true },
              },
            },
          },
          casts: {
            select: {
              tmdbPersonId: true,
              name: true,
              character: true,
              profilePath: true,
            },
          },
          galleries: {
            select: {
              type: true,
              imagePath: true,
            },
          },
          similarMovies: {
            select: {
              tmdbId: true,
              title: true,
              posterPath: true,
            },
          },
          productionCompanies: {
            select: {
              productionCompany: {
                select: {
                  id: true,
                  name: true,
                  logoPath: true,
                },
              },
            },
          },
        },
      });
    },

    upsertByTmdbId(tmdbId, data) {
      const movieRecord = sanitizeMovieRecord(data);
      return prismaClient.movie.upsert({
        where: { tmdbId },
        create: { tmdbId, ...movieRecord },
        update: movieRecord,
        select: MOVIE_PUBLIC_FIELDS,
      });
    },

    async syncRelations(tmdbId, { genres = [], casts = [], galleries = [], similarMovies = [], similarMovieIds = [], productionCompanies = [] }) {
      const movie = await prismaClient.movie.findUnique({ where: { tmdbId }, select: { id: true } });
      if (!movie) {
        return;
      }

      const normalizedSimilarMovies = Array.isArray(similarMovies) && similarMovies.length > 0
        ? similarMovies
        : Array.isArray(similarMovieIds)
          ? similarMovieIds.map((id) => ({ tmdbId: Number(id), title: null, posterPath: null }))
          : [];

      const genreIds = [];
      for (const genre of genres) {
        const upserted = await prismaClient.genre.upsert({
          where: { tmdbId: genre.tmdbId },
          update: { name: genre.name },
          create: { tmdbId: genre.tmdbId, name: genre.name },
          select: { id: true },
        });
        genreIds.push(upserted.id);
      }

      if (genreIds.length > 0) {
        await prismaClient.movieGenre.deleteMany({ where: { movieId: movie.id } });
        for (const genreId of genreIds) {
          await prismaClient.movieGenre.upsert({
            where: { movieId_genreId: { movieId: movie.id, genreId } },
            update: {},
            create: { movieId: movie.id, genreId },
          });
        }
      }

      await prismaClient.movieCast.deleteMany({ where: { movieId: movie.id } });
      for (const cast of casts) {
        await prismaClient.movieCast.create({
          data: {
            movieId: movie.id,
            tmdbPersonId: cast.tmdbPersonId,
            name: cast.name,
            character: cast.character,
            profilePath: cast.profilePath,
          },
        });
      }

      await prismaClient.movieGallery.deleteMany({ where: { movieId: movie.id } });
      for (const gallery of galleries) {
        await prismaClient.movieGallery.create({
          data: {
            movieId: movie.id,
            type: gallery.type,
            imagePath: gallery.imagePath,
          },
        });
      }

      await prismaClient.similarMovie.deleteMany({ where: { movieId: movie.id } });
      for (const similar of normalizedSimilarMovies) {
        const similarId = Number(similar?.tmdbId ?? similar?.id ?? similar);
        if (!Number.isFinite(similarId) || similarId <= 0) {
          continue;
        }

        await prismaClient.similarMovie.upsert({
          where: { movieId_tmdbId: { movieId: movie.id, tmdbId: similarId } },
          update: {
            title: similar?.title ?? null,
            posterPath: similar?.posterPath ?? similar?.poster ?? null,
          },
          create: {
            movieId: movie.id,
            tmdbId: similarId,
            title: similar?.title ?? 'Unknown title',
            posterPath: similar?.posterPath ?? similar?.poster ?? null,
          },
        });
      }

      await prismaClient.movieProductionCompany.deleteMany({ where: { movieId: movie.id } });
      for (const company of productionCompanies) {
        const companyRow = await prismaClient.productionCompany.upsert({
          where: { id: company.id },
          update: { name: company.name, logoPath: company.logoPath },
          create: { id: company.id, name: company.name, logoPath: company.logoPath },
          select: { id: true },
        });
        await prismaClient.movieProductionCompany.upsert({
          where: { movieId_productionCompanyId: { movieId: movie.id, productionCompanyId: companyRow.id } },
          update: {},
          create: { movieId: movie.id, productionCompanyId: companyRow.id },
        });
      }
    },
  });
}
