import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.mock('@/features/catalog/lists', () => ({
  CATALOG_LISTS: new Proxy({}, { get: () => ({ fetch: fetchMock }) }),
}));

import { GET } from './route';

const call = (qs: string) => GET(new Request(`http://localhost/api/catalog${qs}`));

beforeEach(() => {
  fetchMock.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/catalog', () => {
  it('400 for invalid list', async () => {
    const res = await call('?list=nope&page=1');
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty('error');
  });

  it.each(['0', '501', 'abc', '1.5', ''])('400 for invalid page "%s"', async (p) => {
    expect((await call(`?list=filmes/populares&page=${p}`)).status).toBe(400);
  });

  it('defaults page to 1 and returns the paginated result', async () => {
    const body = { page: 1, totalPages: 1, totalResults: 0, results: [] };
    fetchMock.mockResolvedValue(body);
    const res = await call('?list=filmes/populares');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith(1);
  });

  it('502 when TMDb fails', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const res = await call('?list=filmes/populares&page=2');
    expect(res.status).toBe(502);
    expect(await res.json()).toHaveProperty('error');
  });
});
