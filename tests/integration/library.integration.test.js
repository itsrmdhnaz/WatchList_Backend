import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestEnvironment } from '../helpers/testEnvironment.js';

let app;
let prisma;
let createAccessToken;
let cleanup;
let accessToken;
let firstTmdbId;
let secondTmdbId;

describe('library API', () => {
  beforeAll(async () => {
    ({ app, prisma, createAccessToken, cleanup } = await createTestEnvironment());

    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `library-${suffix}@example.com`,
        password: 'test-only-placeholder-hash',
        displayName: 'Library Owner',
        publicId: randomUUID(),
      },
    });
    accessToken = await createAccessToken(user.id);
    firstTmdbId = 910001;
    secondTmdbId = 910002;

    await prisma.movie.createMany({
      data: [
        {
          tmdbId: firstTmdbId,
          title: 'Cached Movie One',
          voteAverage: 8.1,
          voteCount: 120,
        },
        {
          tmdbId: secondTmdbId,
          title: 'Cached Movie Two',
          voteAverage: 7.2,
          voteCount: 90,
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanup?.();
  });

  it('adds a cached movie with the private plan-to-watch defaults', async () => {
    const response = await request(app)
      .post('/api/v1/library')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tmdbId: firstTmdbId });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      tmdbId: firstTmdbId,
      title: 'Cached Movie One',
      status: 'plan_to_watch',
      visibility: 'private',
    });
    expect(response.body.data).not.toHaveProperty('id');
  });

  it('rejects duplicate movies in the same library', async () => {
    const response = await request(app)
      .post('/api/v1/library')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tmdbId: firstTmdbId });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LIBRARY_ENTRY_ALREADY_EXISTS');
  });

  it('adds watched entries and filters the owner list by status with pagination', async () => {
    const addResponse = await request(app)
      .post('/api/v1/library')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tmdbId: secondTmdbId, status: 'watched', visibility: 'private' });

    expect(addResponse.status).toBe(201);

    const listResponse = await request(app)
      .get('/api/v1/library?status=watched&page=1&limit=1')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0]).toMatchObject({ tmdbId: secondTmdbId, status: 'watched' });
    expect(listResponse.body.meta).toMatchObject({
      page: 1,
      limit: 1,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it("counts private entries in the owner's personal statistics", async () => {
    const response = await request(app)
      .get('/api/v1/library/stats')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ total: 2, watched: 1, planToWatch: 1 });
  });

  it('updates status and visibility for an entry owned by the caller', async () => {
    const response = await request(app)
      .patch(`/api/v1/library/${firstTmdbId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'watched', visibility: 'public' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      tmdbId: firstTmdbId,
      status: 'watched',
      visibility: 'public',
    });

    const statsResponse = await request(app)
      .get('/api/v1/library/stats')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(statsResponse.body.data).toEqual({ total: 2, watched: 2, planToWatch: 0 });
  });

  it('deletes an owned entry and returns 404 when it is deleted again', async () => {
    const response = await request(app)
      .delete(`/api/v1/library/${secondTmdbId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ tmdbId: secondTmdbId, deleted: true });

    const statsResponse = await request(app)
      .get('/api/v1/library/stats')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(statsResponse.body.data).toEqual({ total: 1, watched: 1, planToWatch: 0 });

    const missingResponse = await request(app)
      .delete(`/api/v1/library/${secondTmdbId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.error.code).toBe('LIBRARY_ENTRY_NOT_FOUND');
  });
});
