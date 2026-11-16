/** @param {import('@prisma/client').PrismaClient} prismaClient */
export function createRecommendationRepository(prismaClient) {
  return Object.freeze({
    getMostWatched(limit) {
      return prismaClient.$transaction(async (transaction) => {
        const [groups, watchedRecords] = await Promise.all([
          transaction.userMovie.groupBy({
            by: ['movieId'],
            where: { status: 'watched' },
            _count: { movieId: true },
            orderBy: { _count: { movieId: 'desc' } },
            take: limit,
          }),
          transaction.userMovie.count({ where: { status: 'watched' } }),
        ]);

        if (groups.length === 0) return { watchedRecords, movies: [] };

        const movies = await transaction.movie.findMany({
          where: { id: { in: groups.map(({ movieId }) => movieId) } },
          select: {
            id: true,
            tmdbId: true,
            title: true,
            overview: true,
            releaseDate: true,
            posterPath: true,
            backdropPath: true,
            voteAverage: true,
            voteCount: true,
          },
        });
        const moviesById = new Map(movies.map((movie) => [movie.id, movie]));

        return {
          watchedRecords,
          movies: groups.flatMap((group) => {
            const movie = moviesById.get(group.movieId);
            if (!movie) return [];

            const { id: _internalId, ...movieDetails } = movie;
            return [{ ...movieDetails, watchedCount: group._count.movieId }];
          }),
        };
      });
    },
  });
}
