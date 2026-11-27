import { describe, expect, it } from 'vitest';
import tv1399 from '@/test/fixtures/tv-1399.json';
import { tvDetailSchema } from '../tmdb/detail-schemas';
import { toTvDetails } from '../tmdb/detail-mappers';
import {
  airedEpisodes,
  episodeCode,
  marksThrough,
  marksUpTo,
  seriesProgress,
  toProgressInfo,
  type TvProgressInfo,
} from './progress';
import type { EpisodeMark } from './types';

const info = (over: Partial<TvProgressInfo> = {}): TvProgressInfo => ({
  tvId: 7,
  ended: false,
  seasons: [
    { seasonNumber: 1, episodeCount: 10 },
    { seasonNumber: 2, episodeCount: 10 },
    { seasonNumber: 3, episodeCount: 8 },
  ],
  lastAired: { seasonNumber: 3, episodeNumber: 4 },
  nextToAir: { seasonNumber: 3, episodeNumber: 5, airDate: '2026-12-01' },
  ...over,
});

const mark = (seasonNumber: number, episodeNumber: number): EpisodeMark => ({
  tvId: 7,
  seasonNumber,
  episodeNumber,
  watchedAt: '2026-01-01T00:00:00.000Z',
});

const marksFor = (refs: { seasonNumber: number; episodeNumber: number }[]) =>
  refs.map((r) => mark(r.seasonNumber, r.episodeNumber));

describe('airedEpisodes', () => {
  it('runs through lastAired', () => {
    const aired = airedEpisodes(info());
    expect(aired).toHaveLength(24);
    expect(aired.at(-1)).toEqual({ seasonNumber: 3, episodeNumber: 4 });
  });

  it('falls back to the episode before nextToAir when lastAired is a special', () => {
    const aired = airedEpisodes(
      info({
        lastAired: { seasonNumber: 0, episodeNumber: 3 },
        nextToAir: { seasonNumber: 3, episodeNumber: 5, airDate: null },
      }),
    );
    expect(aired.at(-1)).toEqual({ seasonNumber: 3, episodeNumber: 4 });
  });

  it('counts everything when ended and nothing else is known', () => {
    expect(airedEpisodes(info({ lastAired: null, nextToAir: null, ended: true }))).toHaveLength(28);
  });

  it('counts nothing when not ended and nothing else is known', () => {
    expect(airedEpisodes(info({ lastAired: null, nextToAir: null }))).toHaveLength(0);
  });
});

describe('seriesProgress', () => {
  const aired = airedEpisodes(info());

  it('is not-started without marks or with only a special', () => {
    expect(seriesProgress(info(), [])).toEqual({ kind: 'not-started' });
    expect(seriesProgress(info(), [mark(0, 1)])).toEqual({ kind: 'not-started' });
  });

  it('is in-progress with the first unmarked aired episode as next', () => {
    expect(seriesProgress(info(), [mark(1, 1), mark(1, 2)])).toEqual({
      kind: 'in-progress',
      next: { seasonNumber: 1, episodeNumber: 3 },
      watched: 2,
      total: 24,
    });
  });

  it('is caught-up with the next air date when all aired are marked', () => {
    expect(seriesProgress(info(), marksFor(aired))).toEqual({
      kind: 'caught-up',
      nextAirDate: '2026-12-01',
      watched: 24,
      total: 24,
    });
  });

  it('is finished when ended and everything is marked', () => {
    const ended = info({ ended: true, lastAired: { seasonNumber: 3, episodeNumber: 8 }, nextToAir: null });
    expect(seriesProgress(ended, marksFor(airedEpisodes(ended)))).toEqual({
      kind: 'finished',
      watched: 28,
      total: 28,
    });
  });

  it('goes back to in-progress when new episodes aired after a concluded series', () => {
    const marks = marksFor(aired);
    const grown = info({ lastAired: { seasonNumber: 3, episodeNumber: 6 } });
    expect(seriesProgress(grown, marks)).toMatchObject({
      kind: 'in-progress',
      next: { seasonNumber: 3, episodeNumber: 5 },
      watched: 24,
      total: 26,
    });
  });
});

describe('helpers', () => {
  it('marksUpTo includes aired episodes through the target', () => {
    expect(marksUpTo(info(), { seasonNumber: 2, episodeNumber: 3 })).toHaveLength(13);
  });

  it('marksThrough equals marksUpTo for an episode TMDb already counts as aired', () => {
    const target = { seasonNumber: 2, episodeNumber: 3 };
    expect(marksThrough(info(), target)).toEqual(marksUpTo(info(), target));
  });

  it('marksThrough includes an episode aired today that lastAired does not count yet, and its season before it', () => {
    // lastAired is T3E4; T3E6 aired today (the page knows it by date), T3E5 too.
    const marks = marksThrough(info(), { seasonNumber: 3, episodeNumber: 6 });
    expect(marks).toHaveLength(26);
    expect(marks.slice(-3)).toEqual([
      { seasonNumber: 3, episodeNumber: 4 },
      { seasonNumber: 3, episodeNumber: 5 },
      { seasonNumber: 3, episodeNumber: 6 },
    ]);
    // First episode of a brand-new season: everything aired before it, plus itself.
    const premiere = marksThrough(info({ seasons: [...info().seasons, { seasonNumber: 4, episodeCount: 8 }] }), {
      seasonNumber: 4,
      episodeNumber: 1,
    });
    expect(premiere).toHaveLength(25);
    expect(premiere.at(-1)).toEqual({ seasonNumber: 4, episodeNumber: 1 });
  });

  it('episodeCode formats T{s}E{e}', () => {
    expect(episodeCode({ seasonNumber: 1, episodeNumber: 6 })).toBe('T1E6');
  });
});

describe('toProgressInfo', () => {
  it('derives progress info from the Game of Thrones fixture', () => {
    const tv = toTvDetails(tvDetailSchema.parse(tv1399));
    const p = toProgressInfo(tv);
    expect(p.tvId).toBe(1399);
    expect(p.ended).toBe(true);
    expect(p.seasons).toHaveLength(8);
    expect(p.seasons.every((s) => s.seasonNumber > 0 && s.episodeCount > 0)).toBe(true);
    expect(p.lastAired).toEqual({ seasonNumber: 8, episodeNumber: 6 });
  });
});
