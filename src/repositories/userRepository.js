/**
 * Creates persistence operations for users.
 * Business rules and response shaping belong to the calling service.
 *
 * @param {import('@prisma/client').PrismaClient} prismaClient
 */
export function createUserRepository(prismaClient) {
  return Object.freeze({
    create(data) {
      return prismaClient.user.create({ data });
    },

    findByEmail(email) {
      return prismaClient.user.findUnique({
        where: { email },
      });
    },

    findById(id) {
      return prismaClient.user.findUnique({
        where: { id },
        select: {
          publicId: true,
          email: true,
          displayName: true,
        },
      });
    },
  });
}
