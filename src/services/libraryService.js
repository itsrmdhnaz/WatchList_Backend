import AppError from '../core/errors/AppError.js';

function toLibraryEntry(entry) {
  return {
    tmdbId: entry.movie.tmdbId,
    title: entry.movie.title,
    overview: entry.movie.overview,
    releaseDate: entry.movie.releaseDate,
    posterPath: entry.movie.posterPath,
    backdropPath: entry.movie.backdropPath,
    voteAverage: entry.movie.voteAverage,
    voteCount: entry.movie.voteCount,
    status: entry.status,
    visibility: entry.visibility,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

/**
 * @param {{ movieService: ReturnType<import('../services/movieService.js').createMovieService>, libraryRepository: ReturnType<import('../repositories/libraryRepository.js').createLibraryRepository> }} dependencies
 */
export function createLibraryService({ movieService, libraryRepository }) {
  return Object.freeze({
    async addEntry(userId, input) {
      // Resolve/cache the movie first so user_movies can reference its internal database row.
      await movieService.getMovieDetails(input.tmdbId);

      try {
        const entry = await libraryRepository.createEntry({ userId, ...input });
        return toLibraryEntry(entry);
      } catch (error) {
        if (error?.code === 'P2002') {
          throw new AppError('Movie is already in this library.', {
            statusCode: 409,
            code: 'LIBRARY_ENTRY_ALREADY_EXISTS',
          });
        }

        throw error;
      }
    },

    async listEntries(userId, { status, page, limit, skip }) {
      const result = await libraryRepository.findEntries({
        userId,
        status,
        skip,
        take: limit,
      });

      return {
        entries: result.entries.map(toLibraryEntry),
        meta: {
          page,
          limit,
          totalItems: result.totalItems,
          totalPages: Math.ceil(result.totalItems / limit),
        },
      };
    },

    async getStats(userId) {
      const groupedCounts = await libraryRepository.getStatusCounts(userId);
      const counts = Object.fromEntries(
        groupedCounts.map(({ status, _count }) => [status, _count._all]),
      );
      const watched = counts.watched ?? 0;
      const planToWatch = counts.plan_to_watch ?? 0;

      return {
        total: watched + planToWatch,
        watched,
        planToWatch,
      };
    },

    async updateEntry(userId, tmdbId, data) {
      const entry = await libraryRepository.updateEntry({ userId, tmdbId, data });
      if (!entry) {
        throw new AppError('Movie was not found in your library.', {
          statusCode: 404,
          code: 'LIBRARY_ENTRY_NOT_FOUND',
        });
      }

      return toLibraryEntry(entry);
    },

    async deleteEntry(userId, tmdbId) {
      const deleted = await libraryRepository.deleteEntry({ userId, tmdbId });
      if (!deleted) {
        throw new AppError('Movie was not found in your library.', {
          statusCode: 404,
          code: 'LIBRARY_ENTRY_NOT_FOUND',
        });
      }

      return { tmdbId, deleted: true };
    },
  });
}
