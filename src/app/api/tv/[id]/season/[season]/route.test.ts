import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TmdbError } from '@/features/tmdb/client';

const getSeasonMock = vi.fn();
vi.mock('@/features/tmdb/tv', () => ({ getSeason: (...a: unknown[]) => getSeasonMock(...a) }));

import { GET } from './route';

const call = (id: string, season: string) =>
  GET(new Request(`http://localhost/api/tv/${id}/season/${season}`), { params: Promise.resolve({ id, season }) });
const SEASON = { seasonNumber: 1, name: 'T1', overview: '', episodes: [] };

beforeEach(() => {
  getSeasonMock.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/tv/[id]/season/[season]', () => {
  it('returns the season', async () => {
    getSeasonMock.mockResolvedValue(SEASON);
    const res = await call('1399', '1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(SEASON);
    expect(getSeasonMock).toHaveBeenCalledWith(1399, 1);
  });

  it('accepts season 0 (specials)', async () => {
    getSeasonMock.mockResolvedValue(SEASON);
    expect((await call('1399', '0')).status).toBe(200);
  });

  it.each([
    ['abc', '1'],
    ['0', '1'],
    ['-1', '1'],
    ['1.5', '1'],
    ['1399', 'x'],
    ['1399', '-1'],
    ['1399', '1.5'],
  ])('400 for id=%s season=%s', async (id, season) => {
    expect((await call(id, season)).status).toBe(400);
    expect(getSeasonMock).not.toHaveBeenCalled();
  });

  it('404 when TMDb has no such season', async () => {
    getSeasonMock.mockRejectedValue(new TmdbError('nf', 404, 'tv/1/season/9'));
    const res = await call('1', '9');
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty('error');
  });

  it('502 on other errors', async () => {
    getSeasonMock.mockRejectedValue(new Error('boom'));
    const res = await call('1', '1');
    expect(res.status).toBe(502);
    expect(await res.json()).toHaveProperty('error');
  });
});
