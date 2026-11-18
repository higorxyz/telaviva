import { afterEach, describe, expect, it, vi } from 'vitest';
import { TmdbError } from '@/features/tmdb/client';
import { getSeason } from '@/features/tmdb/tv';
import type { SeasonDetails } from '@/features/tmdb/types';
import { loadSeason } from './load-season';

vi.mock('@/features/tmdb/tv', () => ({ getSeason: vi.fn() }));

const mocked = vi.mocked(getSeason);

describe('loadSeason', () => {
  afterEach(() => vi.restoreAllMocks());

  it('devolve a temporada', async () => {
    const season = { seasonNumber: 1, name: 'T1', overview: '', episodes: [] } as SeasonDetails;
    mocked.mockResolvedValue(season);
    expect(await loadSeason(1, 1)).toEqual({ status: 'ok', season });
  });

  it('404 do TMDb vira "missing" sem log', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocked.mockRejectedValue(new TmdbError('nope', 404, 'tv/1/season/9'));
    expect(await loadSeason(1, 9)).toEqual({ status: 'missing' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('outros erros viram "error" e são logados', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocked.mockRejectedValue(new TmdbError('boom', 500, 'tv/1/season/1'));
    expect(await loadSeason(1, 1)).toEqual({ status: 'error' });
    expect(spy).toHaveBeenCalledOnce();
  });
});
