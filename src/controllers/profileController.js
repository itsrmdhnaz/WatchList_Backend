import Response from '../core/response/Response.js';

/** @param {ReturnType<import('../services/profileService.js').createProfileService>} profileService */
export function createProfileController(profileService) {
  return Object.freeze({
   async getProfile(req, res) {
      const profile = await profileService.getProfile(
        req.publicId,
        req.auth.userId,
      );

      return res.status(200).json(
        Response.success(profile, {
          message: 'Profile loaded successfully.',
        }),
      );
    },

    async getMovies(req, res) {
      const result = await profileService.getProfileMovies(
        req.publicId,
        req.auth.userId,
        req.profileMoviesInput,
      );
      return res.status(200).json(
        Response.success(result.movies, {
          message: 'Profile movies loaded successfully.',
          meta: result.meta,
        }),
      );
    },

    async updateVisibility(req, res) {
      const profile = await profileService.updateProfileVisibility(req.publicId, req.auth.userId);

      return res.status(200).json(
        Response.success(profile, { message: 'Profile visibility updated successfully.' }),
      );
    }
  });
}
