import { beforeEach, describe, expect, it, vi } from 'vitest';

const discoverMock = vi.fn();
vi.mock('@/features/tmdb/discover', () => ({ discover: (...a: unknown[]) => discoverMock(...a) }));

import { GET } from './route';

const call = (qs: string) => GET(new Request(`http://localhost/api/discover${qs}`));
const BODY = { page: 1, totalPages: 2, totalResults: 30, results: [] };

beforeEach(() => {
  discoverMock.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/discover', () => {
  it.each(['0', '501', 'abc', '1.5', ''])('400 for invalid page "%s"', async (p) => {
    expect((await call(`?page=${p}`)).status).toBe(400);
    expect(discoverMock).not.toHaveBeenCalled();
  });

  it('parses the filters and forwards TMDb params and page', async () => {
    discoverMock.mockResolvedValue(BODY);
    const res = await call('?tipo=serie&generos=18&nota=8&page=3');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(BODY);
    expect(discoverMock).toHaveBeenCalledWith(
      'tv',
      expect.objectContaining({ with_genres: '18', 'vote_average.gte': 8, sort_by: 'popularity.desc' }),
      3,
    );
  });

  it('genre pagination (no disponivel param) keeps to titles available in Brazil; disponivel=0 does not', async () => {
    discoverMock.mockResolvedValue(BODY);
    const BR = { watch_region: 'BR', with_watch_monetization_types: 'flatrate|free|ads|rent|buy' };
    await call('?tipo=filme&generos=28&page=2');
    expect(discoverMock).toHaveBeenLastCalledWith('movie', expect.objectContaining({ with_genres: '28', ...BR }), 2);
    await call('?tipo=filme&generos=28&disponivel=0&page=2');
    expect(discoverMock.mock.lastCall![1]).not.toHaveProperty('with_watch_monetization_types');
  });

  it('defaults to movies on page 1', async () => {
    discoverMock.mockResolvedValue(BODY);
    await call('');
    expect(discoverMock).toHaveBeenCalledWith('movie', expect.any(Object), 1);
  });

  it('502 when TMDb fails, logging the error', async () => {
    discoverMock.mockRejectedValue(new Error('boom'));
    const res = await call('?page=1');
    expect(res.status).toBe(502);
    expect(await res.json()).toHaveProperty('error');
    expect(console.error).toHaveBeenCalled();
  });
});
