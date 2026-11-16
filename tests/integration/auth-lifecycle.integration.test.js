import { createHash, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestEnvironment } from '../helpers/testEnvironment.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PASSWORD = 'correct-horse-battery-staple-2026!';
let app;
let prisma;
let cleanup;
let corsOrigin;
let email;

function readRefreshCookie(response) {
  const cookie = response.headers['set-cookie']?.find((value) => value.startsWith('refreshToken='));
  return cookie?.slice('refreshToken='.length).split(';', 1)[0];
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

describe('authentication lifecycle', () => {
  beforeAll(async () => {
    ({ app, prisma, cleanup, corsOrigin } = await createTestEnvironment());
    email = `auth-${randomUUID()}@example.com`;
  });

  afterAll(async () => {
    await cleanup?.();
  });

  it('registers a user and stores only an Argon2id password hash', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', corsOrigin)
      .send({ email: `  ${email.toUpperCase()}  `, password: PASSWORD, displayName: '  Test User  ' });

    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({ email, displayName: 'Test User' });
    expect(response.body.data.user).not.toHaveProperty('password');

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user.password).not.toBe(PASSWORD);
    expect(await argon2.verify(user.password, PASSWORD)).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', corsOrigin)
      .send({ email, password: PASSWORD, displayName: 'Duplicate User' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('returns a generic error for an invalid password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', corsOrigin)
      .send({ email, password: 'incorrect-horse-battery-staple-2026!' });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid email or password.');
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('issues the short refresh session in an HttpOnly cookie and stores only its hash', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', corsOrigin)
      .send({ email, password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeTypeOf('string');
    expect(response.body.data).not.toHaveProperty('refreshToken');

    const rawToken = readRefreshCookie(response);
    expect(rawToken).toBeTruthy();
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('Path=/api/v1/auth');

    const session = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    expect(session).not.toBeNull();
    expect(session.tokenHash).not.toBe(rawToken);
    const ttlDays = (session.expiresAt.getTime() - Date.now()) / DAY_IN_MS;
    expect(ttlDays).toBeGreaterThan(0.99);
    expect(ttlDays).toBeLessThanOrEqual(1);
  });

  it('uses the 30-day Remember Me lifetime', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', corsOrigin)
      .send({ email, password: PASSWORD, rememberMe: true });

    expect(response.status).toBe(200);
    const rawToken = readRefreshCookie(response);
    const session = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    const ttlDays = (session.expiresAt.getTime() - Date.now()) / DAY_IN_MS;
    expect(ttlDays).toBeGreaterThan(29.99);
    expect(ttlDays).toBeLessThanOrEqual(30);
  });

  it('rotates refresh tokens, revokes sessions on logout, and clears the cookie', async () => {
    const agent = request.agent(app);
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', corsOrigin)
      .send({ email, password: PASSWORD, rememberMe: true });
    const oldToken = readRefreshCookie(loginResponse);

    const refreshResponse = await agent
      .post('/api/v1/auth/refresh')
      .set('Origin', corsOrigin);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.data.accessToken).toBeTypeOf('string');
    const rotatedToken = readRefreshCookie(refreshResponse);
    expect(rotatedToken).toBeTruthy();
    expect(rotatedToken).not.toBe(oldToken);

    const oldSession = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(oldToken) } });
    const activeSession = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rotatedToken) } });
    expect(oldSession.revokedAt).toBeInstanceOf(Date);
    expect(activeSession.revokedAt).toBeNull();

    const logoutResponse = await agent
      .post('/api/v1/auth/logout')
      .set('Origin', corsOrigin);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
    const loggedOutSession = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rotatedToken) },
    });
    expect(loggedOutSession.revokedAt).toBeInstanceOf(Date);

    const refreshAfterLogout = await agent
      .post('/api/v1/auth/refresh')
      .set('Origin', corsOrigin);
    expect(refreshAfterLogout.status).toBe(401);
  });
});
