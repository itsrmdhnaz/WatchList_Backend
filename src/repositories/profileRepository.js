/** @param {import('@prisma/client').PrismaClient} prismaClient */
export function createProfileRepository(prismaClient) {
  return Object.freeze({
    findByPublicId(publicId) {
      return prismaClient.user.findUnique({
        where: { publicId },
        select: {
          id: true,
          publicId: true,
          displayName: true,
        },
      });
    },

    async findMovies({ publicId, includePrivate, status, skip, take }) {
      const where = {
        user: { publicId },
        ...(includePrivate ? {} : { visibility: 'public' }),
        ...(status ? { status } : {}),
      };
      const [entries, totalItems] = await prismaClient.$transaction([
        prismaClient.userMovie.findMany({
          where,
          skip,
          take,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            status: true,
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
          },
        }),
        prismaClient.userMovie.count({ where }),
      ]);

      return { entries, totalItems };
    },

    async updateProfileVisibility(publicId, userId, visibility) {
      const updatedProfile = await prismaClient.user.updateMany({
        where: {
          publicId,
          id: userId,
        },
        data: {
          visibility,
        },
      });

      if (updatedProfile.count === 0) {
        throw new Error('Profile not found or user does not have permission to update visibility.');
      }

      return updatedProfile;
    }
  });
}
