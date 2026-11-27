import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TmdbError } from '@/features/tmdb/client';

const getTvProgressSourceMock = vi.fn();
vi.mock('@/features/tmdb/tv', () => ({ getTvProgressSource: (...a: unknown[]) => getTvProgressSourceMock(...a) }));

import { GET } from './route';

const call = (qs: string) => GET(new Request(`http://localhost/api/tv/progress${qs}`));
const notFound = () => new TmdbError('nf', 404, 'tv/x');
const tv = (id: number) => ({
  id,
  status: 'Ended',
  seasons: [{ seasonNumber: 1, episodeCount: 2 }],
  nextEpisodeToAir: null,
  lastEpisodeToAir: { seasonNumber: 1, episodeNumber: 2, airDate: '2020-01-01' },
});

beforeEach(() => {
  getTvProgressSourceMock.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/tv/progress', () => {
  it('returns progress by id and omits a 404', async () => {
    getTvProgressSourceMock.mockImplementation((id: number) => (id === 2 ? Promise.reject(notFound()) : Promise.resolve(tv(id))));
    const res = await call('?ids=1,2');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['1']);
    expect(body['1']).toMatchObject({ tvId: 1, ended: true, seasons: [{ seasonNumber: 1, episodeCount: 2 }] });
  });

  it('trims and dedupes ids', async () => {
    getTvProgressSourceMock.mockImplementation((id: number) => Promise.resolve(tv(id)));
    await call('?ids=1, 1 ,2');
    expect(getTvProgressSourceMock).toHaveBeenCalledTimes(2);
  });

  it('400 for 41 ids', async () => {
    const ids = Array.from({ length: 41 }, (_, i) => i + 1).join(',');
    expect((await call(`?ids=${ids}`)).status).toBe(400);
    expect(getTvProgressSourceMock).not.toHaveBeenCalled();
  });

  it('accepts 40 ids', async () => {
    getTvProgressSourceMock.mockImplementation((id: number) => Promise.resolve(tv(id)));
    const ids = Array.from({ length: 40 }, (_, i) => i + 1).join(',');
    expect((await call(`?ids=${ids}`)).status).toBe(200);
  });

  it.each(['?ids=abc', '?ids=1,x', '?ids=', '', '?ids=1.5', '?ids=0', '?ids=-3'])('400 for "%s"', async (qs) => {
    expect((await call(qs)).status).toBe(400);
    expect(getTvProgressSourceMock).not.toHaveBeenCalled();
  });

  it('omits non-404 failures when something succeeded', async () => {
    getTvProgressSourceMock.mockImplementation((id: number) => (id === 2 ? Promise.reject(new Error('boom')) : Promise.resolve(tv(id))));
    const res = await call('?ids=1,2');
    expect(res.status).toBe(200);
    expect(Object.keys((await res.json()) as object)).toEqual(['1']);
  });

  it('502 when every id fails with a non-404 error', async () => {
    getTvProgressSourceMock.mockRejectedValue(new Error('boom'));
    expect((await call('?ids=1,2')).status).toBe(502);
  });

  it('200 with {} when every id is a 404', async () => {
    getTvProgressSourceMock.mockRejectedValue(notFound());
    const res = await call('?ids=1,2');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });
  it('429 with Retry-After after 120 requests a minute from one IP', async () => {
    getTvProgressSourceMock.mockImplementation((id: number) => Promise.resolve(tv(id)));
    const fromIp = () =>
      GET(new Request('http://localhost/api/tv/progress?ids=1', { headers: { 'x-forwarded-for': '192.0.2.88' } }));
    for (let i = 0; i < 120; i++) expect((await fromIp()).status).toBe(200);
    const blocked = await fromIp();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toMatch(/^\d+$/);
  });
});
