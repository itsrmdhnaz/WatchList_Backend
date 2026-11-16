import AppError from '../core/errors/AppError.js';

function toProfile(profile) {
  return {
    publicId: profile.publicId,
    displayName: profile.displayName,
    visibility: profile.visibility,
  };
}

function toPublicMovieEntry(entry) {
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
  };
}

/** @param {{ profileRepository: ReturnType<import('../repositories/profileRepository.js').createProfileRepository> }} dependencies */
export function createProfileService({ profileRepository }) {
  return Object.freeze({
    async getProfile(publicId) {
      const profile = await profileRepository.findByPublicId(publicId);
      if (!profile) {
        throw new AppError('Profile was not found.', {
          statusCode: 404,
          code: 'PROFILE_NOT_FOUND',
        });
      }

      return toProfile(profile);
    },

    async getProfileMovies(publicId, requestingUserId, { status, page, limit, skip }) {
      const profile = await profileRepository.findByPublicId(publicId);
      if (!profile) {
        throw new AppError('Profile was not found.', {
          statusCode: 404,
          code: 'PROFILE_NOT_FOUND',
        });
      }

      const result = await profileRepository.findMovies({
        publicId,
        includePrivate: profile.id === requestingUserId,
        status,
        skip,
        take: limit,
      });

      return {
        movies: result.entries.map(toPublicMovieEntry),
        meta: {
          page,
          limit,
          totalItems: result.totalItems,
          totalPages: Math.ceil(result.totalItems / limit),
        },
      };
    },

    async updateProfileVisibility(publicId, userId) {
      const profile = await profileRepository.findByPublicId(publicId);
      if (!profile) {
        throw new AppError('Profile was not found.', {
          statusCode: 404,
          code: 'PROFILE_NOT_FOUND',
        });
      }

      if (profile.id !== userId) {
        throw new AppError('You are not the owner of this profile.', {
          statusCode: 403,
          code: 'FORBIDDEN',
        });
      }

      return await profileRepository.updateVisibility(publicId, userId, profile.visibility === 'public' ? 'private' : 'public');
    },    
  });
}
