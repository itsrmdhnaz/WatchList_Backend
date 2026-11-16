const LIBRARY_ENTRY_FIELDS = Object.freeze({
  status: true,
  visibility: true,
  createdAt: true,
  updatedAt: true,
  movie: {
    select: {
      tmdbId: true,
      title: true,
      overview: true,
      releaseDate: true,
      posterPath: true,
      backdropPath: true,
      voteAverage: true,
      voteCount: true,
    },
  },
});

/** @param {import('@prisma/client').PrismaClient} prismaClient */
export function createLibraryRepository(prismaClient) {
  return Object.freeze({
    createEntry({ userId, tmdbId, status, visibility }) {
      return prismaClient.userMovie.create({
        data: {
          status,
          visibility,
          user: { connect: { id: userId } },
          movie: { connect: { tmdbId } },
        },
        select: LIBRARY_ENTRY_FIELDS,
      });
    },

    async findEntries({ userId, status, skip, take }) {
      const where = { userId, ...(status ? { status } : {}) };
      const [entries, totalItems] = await prismaClient.$transaction([
        prismaClient.userMovie.findMany({
          where,
          skip,
          take,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: LIBRARY_ENTRY_FIELDS,
        }),
        prismaClient.userMovie.count({ where }),
      ]);
      return { entries, totalItems };
    },

    getStatusCounts(userId) {
      return prismaClient.userMovie.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      });
    },

    updateEntry({ userId, tmdbId, data }) {
      return prismaClient.$transaction(async (transaction) => {
        const existingEntry = await transaction.userMovie.findFirst({
          where: { userId, movie: { tmdbId } },
          select: { id: true },
        });
        if (!existingEntry) return null;

        return transaction.userMovie.update({
          where: { id: existingEntry.id },
          data,
          select: LIBRARY_ENTRY_FIELDS,
        });
      });
    },

    deleteEntry({ userId, tmdbId }) {
      return prismaClient.$transaction(async (transaction) => {
        const existingEntry = await transaction.userMovie.findFirst({
          where: { userId, movie: { tmdbId } },
          select: { id: true },
        });
        if (!existingEntry) return false;

        await transaction.userMovie.delete({ where: { id: existingEntry.id } });
        return true;
      });
    },
  });
}
