import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';

describe('application HTTP smoke checks', () => {
  it('returns the standard success envelope from the health endpoint', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Service is healthy',
      data: { status: 'ok' },
    });
  });

  it('allows Swagger Preview loopback origins in development', async () => {
    const origin = 'http://localhost:18512';
    const response = await request(app)
      .get('/health')
      .set('Origin', origin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow an unlisted non-loopback browser origin', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://untrusted.example');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('accepts Swagger Preview as a trusted auth origin in development', async () => {
    const origin = 'http://localhost:18512';
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({});

    expect(response.status).toBe(400);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unlisted origins before reaching auth validation', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://untrusted.example')
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it.each([
    ['/api/v1/auth/current-user', 'get'],
    ['/api/v1/library', 'get'],
    ['/api/v1/library/stats', 'get'],
    ['/api/v1/profiles/00000000-0000-4000-8000-000000000000', 'get'],
    ['/api/v1/profiles/00000000-0000-4000-8000-000000000000/movies', 'get'],
  ])('requires authentication for %s', async (path, method) => {
    const response = await request(app)[method](path);

    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer realm="movie-platform"');
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });
});
