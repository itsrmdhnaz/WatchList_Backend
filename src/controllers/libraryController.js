import Response from '../core/response/Response.js';

/** @param {ReturnType<import('../services/libraryService.js').createLibraryService>} libraryService */
export function createLibraryController(libraryService) {
  return Object.freeze({
    async stats(req, res) {
      const stats = await libraryService.getStats(req.auth.userId);
      return res.status(200).json(
        Response.success(stats, { message: 'Your library statistics loaded successfully.' }),
      );
    },

    async list(req, res) {
      const result = await libraryService.listEntries(req.auth.userId, req.libraryListInput);
      return res.status(200).json(
        Response.success(result.entries, {
          message: 'Your library loaded successfully.',
          meta: result.meta,
        }),
      );
    },

    async add(req, res) {
      const entry = await libraryService.addEntry(req.auth.userId, req.libraryEntryInput);
      return res.status(201).json(
        Response.success(entry, { message: 'Movie added to your library.' }),
      );
    },

    async update(req, res) {
      const entry = await libraryService.updateEntry(
        req.auth.userId,
        req.libraryTmdbId,
        req.libraryUpdateInput,
      );
      return res.status(200).json(
        Response.success(entry, { message: 'Library entry updated successfully.' }),
      );
    },

    async remove(req, res) {
      const result = await libraryService.deleteEntry(req.auth.userId, req.libraryTmdbId);
      return res.status(200).json(
        Response.success(result, { message: 'Movie removed from your library.' }),
      );
    },
  });
}
