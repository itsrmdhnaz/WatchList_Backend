/**
 * Creates persistence operations for refresh-token sessions.
 *
 * @param {import('@prisma/client').PrismaClient} prismaClient
 */
export function createRefreshTokenRepository(prismaClient) {
  return Object.freeze({
    create(data) {
      return prismaClient.refreshToken.create({ data });
    },

    findByTokenHash(tokenHash) {
      return prismaClient.refreshToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
          revokedAt: true,
        },
      });
    },

    rotate({ userId, tokenHash, revokedAt, successor }) {
      return prismaClient.$transaction(async (transaction) => {
        const result = await transaction.refreshToken.updateMany({
          where: {
            tokenHash,
            userId,
            revokedAt: null,
            expiresAt: { gt: revokedAt },
          },
          data: { revokedAt },
        });

        if (result.count !== 1) {
          // The schema has no session-family key, so a detected replay revokes
          // every active session for this user as the conservative fallback.
          await transaction.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt },
          });
          return false;
        }

        await transaction.refreshToken.create({ data: successor });
        return true;
      });
    },

    async revokeByTokenHash(tokenHash, revokedAt) {
      const result = await prismaClient.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt },
      });

      return result.count === 1;
    },

    revokeAllActiveByUserId(userId, revokedAt) {
      return prismaClient.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt },
      });
    },
  });
}
