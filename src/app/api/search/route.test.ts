import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchMock = vi.fn();
vi.mock('@/features/tmdb/search', () => ({ searchMulti: (...a: unknown[]) => searchMock(...a) }));

import { GET } from './route';

const call = (qs: string) => GET(new Request(`http://localhost/api/search${qs}`));
const EMPTY = { page: 1, totalPages: 0, totalResults: 0, results: [] };

beforeEach(() => {
  searchMock.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/search', () => {
  it.each(['', '?q=', '?q=a', '?q=%20%20', `?q=${'x'.repeat(101)}`])(
    '200 with the empty page for invalid query "%s"',
    async (qs) => {
      const res = await call(qs);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(EMPTY);
      expect(searchMock).not.toHaveBeenCalled();
    },
  );

  it.each(['0', '501', 'abc', '1.5', ''])('400 for invalid page "%s"', async (p) => {
    expect((await call(`?q=matrix&page=${p}`)).status).toBe(400);
  });

  it('passes the normalized query and page through', async () => {
    const body = { page: 2, totalPages: 3, totalResults: 50, results: [] };
    searchMock.mockResolvedValue(body);
    const res = await call('?q=%20%20cora%C3%A7%C3%A3o%20%20selvagem&page=2');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(body);
    expect(searchMock).toHaveBeenCalledWith('coração selvagem', 2);
  });

  it('defaults page to 1 and decodes a&b', async () => {
    searchMock.mockResolvedValue(EMPTY);
    await call('?q=a%26b');
    expect(searchMock).toHaveBeenCalledWith('a&b', 1);
  });

  it('502 when TMDb fails', async () => {
    searchMock.mockRejectedValue(new Error('boom'));
    const res = await call('?q=matrix');
    expect(res.status).toBe(502);
    expect(await res.json()).toHaveProperty('error');
  });
});
