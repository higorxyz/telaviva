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
