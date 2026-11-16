import { describe, expect, it, vi } from 'vitest';
import { createTmdbClient } from '../../src/integrations/tmdb/tmdbClient.js';

describe('TMDB client popular movies method', () => {
  it('requests the v3 movie popular endpoint with configured parameters', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ page: 1, results: [] }),
    });
    const client = createTmdbClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.example.test/3/',
      language: 'id-ID',
      timeoutMs: 1000,
      fetchImpl,
    });

    await client.getPopularMovies(2);

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url.pathname).toBe('/3/movie/popular');
    expect(url.searchParams.get('api_key')).toBe('test-api-key');
    expect(url.searchParams.get('language')).toBe('id-ID');
    expect(url.searchParams.get('page')).toBe('2');
    expect(options.method).toBe('GET');
  });

  it('rejects invalid movie pages without making a request', () => {
    const fetchImpl = vi.fn();
    const client = createTmdbClient({ apiKey: 'test-api-key', fetchImpl });

    expect(() => client.getPopularMovies(501)).toThrow(TypeError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
