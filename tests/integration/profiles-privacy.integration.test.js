import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestEnvironment } from '../helpers/testEnvironment.js';

let app;
let prisma;
let createAccessToken;
let cleanup;
let ownerToken;
let viewerToken;
let ownerPublicId;

describe('profile collection privacy', () => {
  beforeAll(async () => {
    ({ app, prisma, createAccessToken, cleanup } = await createTestEnvironment());

    const suffix = randomUUID();
    const owner = await prisma.user.create({
      data: {
        email: `owner-${suffix}@example.com`,
        password: 'test-only-placeholder-hash',
        displayName: 'Collection Owner',
        publicId: randomUUID(),
      },
    });
    const viewer = await prisma.user.create({
      data: {
        email: `viewer-${suffix}@example.com`,
        password: 'test-only-placeholder-hash',
        displayName: 'Collection Viewer',
        publicId: randomUUID(),
      },
    });
    ownerPublicId = owner.publicId;
    ownerToken = await createAccessToken(owner.id);
    viewerToken = await createAccessToken(viewer.id);

    const publicMovie = await prisma.movie.create({
      data: {
        tmdbId: 900001,
        title: 'Public Collection Film',
        overview: null,
        releaseDate: null,
        posterPath: null,
        backdropPath: null,
        voteAverage: 8,
        voteCount: 100,
      },
    });
    const privateMovie = await prisma.movie.create({
      data: {
        tmdbId: 900002,
        title: 'Private Collection Film',
        overview: null,
        releaseDate: null,
        posterPath: null,
        backdropPath: null,
        voteAverage: 7,
        voteCount: 80,
      },
    });

    await prisma.userMovie.createMany({
      data: [
        { userId: owner.id, movieId: publicMovie.id, status: 'watched', visibility: 'public' },
        { userId: owner.id, movieId: privateMovie.id, status: 'plan_to_watch', visibility: 'private' },
      ],
    });
  });

  afterAll(async () => {
    await cleanup?.();
  });

  it('allows the profile owner to see private entries in their own collection', async () => {
    const response = await request(app)
      .get(`/api/v1/profiles/${ownerPublicId}/movies`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.map(({ title }) => title)).toEqual([
      'Private Collection Film',
      'Public Collection Film',
    ]);
    expect(response.body.meta.totalItems).toBe(2);
  });

  it('shows other viewers only public entries and counts only those entries', async () => {
    const response = await request(app)
      .get(`/api/v1/profiles/${ownerPublicId}/movies`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.map(({ title }) => title)).toEqual(['Public Collection Film']);
    expect(response.body.meta.totalItems).toBe(1);
    expect(response.body.data[0]).not.toHaveProperty('id');
    expect(response.body.data[0]).not.toHaveProperty('userId');
  });

  it('does not reveal private entries through a filtered result or its pagination total', async () => {
    const response = await request(app)
      .get(`/api/v1/profiles/${ownerPublicId}/movies?status=plan_to_watch`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.totalItems).toBe(0);
  });

  it('does not return the account email in the public profile summary', async () => {
    const response = await request(app)
      .get(`/api/v1/profiles/${ownerPublicId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      publicId: ownerPublicId,
      displayName: 'Collection Owner',
    });
  });
});
