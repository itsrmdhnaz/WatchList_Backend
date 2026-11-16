import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestEnvironment } from '../helpers/testEnvironment.js';

let app;
let prisma;
let cleanup;
let mostWatchedMinimumRecords;

describe('Most Watched recommendations', () => {
  beforeAll(async () => {
    ({ app, prisma, cleanup, mostWatchedMinimumRecords } = await createTestEnvironment());
    const suffix = randomUUID();

    const users = await Promise.all(Array.from({ length: mostWatchedMinimumRecords }, (_, index) => (
      prisma.user.create({
        data: {
          email: `recommendation-${suffix}-${index}@example.com`,
          password: 'test-only-placeholder-hash',
          displayName: `Recommendation User ${index}`,
          publicId: randomUUID(),
        },
      })
    )));

    const [mostWatched, runnerUp, planOnly] = await Promise.all([
      prisma.movie.create({
        data: { tmdbId: 920001, title: 'Most Watched Film', voteAverage: 8, voteCount: 100 },
      }),
      prisma.movie.create({
        data: { tmdbId: 920002, title: 'Runner Up Film', voteAverage: 7, voteCount: 80 },
      }),
      prisma.movie.create({
        data: { tmdbId: 920003, title: 'Plan Only Film', voteAverage: 9, voteCount: 50 },
      }),
    ]);

    const watchedEntries = users.map((user, index) => ({
      userId: user.id,
      movieId: index < 6 ? mostWatched.id : runnerUp.id,
      status: 'watched',
      visibility: index < 6 ? 'private' : 'public',
    }));
    const planEntries = users.map((user) => ({
      userId: user.id,
      movieId: planOnly.id,
      status: 'plan_to_watch',
      visibility: 'private',
    }));
    await prisma.userMovie.createMany({ data: [...watchedEntries, ...planEntries] });
  });

  afterAll(async () => {
    await cleanup?.();
  });

  it('ranks watched films including private counts and excludes plan-to-watch entries', async () => {
    const response = await request(app).get('/api/v1/recommendations/most-watched');

    expect(response.status).toBe(200);
    expect(response.body.meta.source).toBe('local_most_watched');
    expect(response.body.data).toEqual([
      expect.objectContaining({ tmdbId: 920001, title: 'Most Watched Film', watchedCount: 6 }),
      expect.objectContaining({ tmdbId: 920002, title: 'Runner Up Film', watchedCount: 4 }),
    ]);
    expect(response.body.data.some(({ tmdbId }) => tmdbId === 920003)).toBe(false);
    expect(response.body.data.every((movie) => !Object.hasOwn(movie, 'userId'))).toBe(true);
    expect(response.body.data.every((movie) => !Object.hasOwn(movie, 'id'))).toBe(true);
  });
});
