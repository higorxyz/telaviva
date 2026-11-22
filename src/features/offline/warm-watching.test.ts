import { describe, expect, it } from 'vitest';
import type { TvProgressInfo } from '../library/progress';
import { entry, mark } from '../library/view/test-state';
import { keepWarmEntries, parseLastWarm, planWarmUp, warmHeaders } from './warm-watching';

const NOW = '2026-11-22T12:00:00.000Z';
const hoursAgo = (h: number) => new Date(Date.parse(NOW) - h * 3_600_000).toISOString();
const minutesAfter = (m: number) => new Date(Date.parse('2026-11-01T00:00:00.000Z') + m * 60_000).toISOString();

const info = (tvId: number, seasons: number[], last: [number, number] | null = null): TvProgressInfo => ({
  tvId,
  ended: false,
  seasons: seasons.map((seasonNumber) => ({ seasonNumber, episodeCount: 10 })),
  lastAired: last ? { seasonNumber: last[0], episodeNumber: last[1] } : { seasonNumber: seasons.at(-1)!, episodeNumber: 10 },
  nextToAir: null,
});

const watching = (id: number, minute = id) =>
  entry('tv', id, 'watching', { title: `Série ${id}`, updatedAt: minutesAfter(minute) });

describe('planWarmUp', () => {
  it('warms the page, the current season and the next one of each series being watched', () => {
    const items = [entry('tv', 7, 'watching', { title: 'Ruptura: Temporada' })];
    const plan = planWarmUp(items, {}, NOW, { progress: { 7: info(7, [1, 2, 3]) }, episodes: [mark(7, 1, 1)] });
    expect(plan).toEqual([
      { url: '/serie/7-ruptura-temporada', key: 'tv:7' },
      { url: '/api/tv/7/season/1', key: 'tv:7' },
      { url: '/api/tv/7/season/2', key: 'tv:7' },
    ]);
  });

  it('takes the season of the next episode to watch as the current one', () => {
    const plan = planWarmUp([watching(7)], {}, NOW, {
      progress: { 7: info(7, [1, 2, 3]) },
      episodes: Array.from({ length: 10 }, (_, i) => mark(7, 1, i + 1)),
    });
    expect(plan.map((s) => s.url)).toEqual(['/serie/7-serie-7', '/api/tv/7/season/2', '/api/tv/7/season/3']);
  });

  it('leaves the next season out when there is none', () => {
    const marks = [...Array.from({ length: 10 }, (_, i) => mark(7, 1, i + 1)), mark(7, 2, 1)];
    const plan = planWarmUp([watching(7)], {}, NOW, { progress: { 7: info(7, [1, 2]) }, episodes: marks });
    expect(plan.map((s) => s.url)).toEqual(['/serie/7-serie-7', '/api/tv/7/season/2']);
  });

  it('starts at the first aired season of a series not started yet', () => {
    const plan = planWarmUp([watching(7)], {}, NOW, { progress: { 7: info(7, [1, 2]) }, episodes: [] });
    expect(plan.map((s) => s.url)).toEqual(['/serie/7-serie-7', '/api/tv/7/season/1', '/api/tv/7/season/2']);
  });

  it('takes the latest aired season of a caught-up series and the announced one after it', () => {
    const caughtUp = info(7, [1, 2], [1, 10]);
    const marks = Array.from({ length: 10 }, (_, i) => mark(7, 1, i + 1));
    const plan = planWarmUp([watching(7)], {}, NOW, { progress: { 7: caughtUp }, episodes: marks });
    expect(plan.map((s) => s.url)).toEqual(['/serie/7-serie-7', '/api/tv/7/season/1', '/api/tv/7/season/2']);
  });

  it('keeps the 12 series updated most recently, newest first, and only series being watched', () => {
    const items = [
      ...Array.from({ length: 14 }, (_, i) => watching(i + 1)),
      entry('tv', 50, 'want', { updatedAt: minutesAfter(99) }),
      entry('tv', 51, 'watched', { updatedAt: minutesAfter(99) }),
      entry('movie', 52, 'watching', { updatedAt: minutesAfter(99) }),
    ];
    const progress = Object.fromEntries([...items.map((i) => i.tmdbId)].map((id) => [id, info(id, [1])]));
    const keys = [...new Set(planWarmUp(items, {}, NOW, { progress, episodes: [] }).map((s) => s.key))];
    expect(keys).toEqual([14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((id) => `tv:${id}`));
  });

  it('skips a series warmed less than 6 h ago, without letting an older one take its place', () => {
    const items = Array.from({ length: 13 }, (_, i) => watching(i + 1));
    const progress = Object.fromEntries(items.map((i) => [i.tmdbId, info(i.tmdbId, [1])]));
    const lastWarm = { 'tv:13': hoursAgo(5.9), 'tv:12': hoursAgo(6), 'tv:11': hoursAgo(30) };
    const keys = [...new Set(planWarmUp(items, lastWarm, NOW, { progress, episodes: [] }).map((s) => s.key))];
    expect(keys).not.toContain('tv:13');
    expect(keys).toContain('tv:12');
    expect(keys).toContain('tv:11');
    expect(keys).not.toContain('tv:1');
    expect(keys).toHaveLength(11);
  });

  it('warms again a series whose last warm-up is dated in the future (a clock that moved back)', () => {
    const plan = planWarmUp([watching(7)], { 'tv:7': hoursAgo(-48) }, NOW, {
      progress: { 7: info(7, [1]) },
      episodes: [],
    });
    expect(plan).toHaveLength(2);
  });

  it('waits for the progress of a series before warming it (its seasons are not known yet)', () => {
    const plan = planWarmUp([watching(7), watching(8)], {}, NOW, { progress: { 8: info(8, [1]) }, episodes: [] });
    expect([...new Set(plan.map((s) => s.key))]).toEqual(['tv:8']);
  });
});

describe('warm-up requests', () => {
  it('asks for a page as a document with the warm-up header, and for a season as a plain request', () => {
    expect(warmHeaders('/serie/7-x')).toEqual({ 'X-TelaViva-Warm': '1', Accept: 'text/html' });
    expect(warmHeaders('/api/tv/7/season/1')).toEqual({});
  });
});

describe('last warm-up record', () => {
  it('reads only well-formed entries', () => {
    expect(parseLastWarm(undefined)).toEqual({});
    expect(parseLastWarm(['tv:1'])).toEqual({});
    expect(parseLastWarm({ 'tv:1': NOW, 'tv:2': 3, 'tv:3': 'not a date' })).toEqual({ 'tv:1': NOW });
  });

  it('keeps only the series still among the ones saved for offline', () => {
    expect(keepWarmEntries({ 'tv:1': NOW, 'tv:2': NOW }, ['tv:2', 'tv:3'])).toEqual({ 'tv:2': NOW });
  });
});
