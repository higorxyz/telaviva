import { describe, expect, it } from 'vitest';
import { mergeLibraries } from './merge';
import { EMPTY_LIBRARY, type EpisodeMark, type LibraryItem, type LibraryState, type Rating } from './types';

const T0 = '2026-11-20T10:00:00.000Z';
const T1 = '2026-11-20T11:00:00.000Z';
const T2 = '2026-11-20T12:00:00.000Z';
const snapshot = { title: 'Família Soprano', posterPath: '/s.jpg', releaseDate: '1999-01-10', genreIds: [18, 80] };
const renamed = { ...snapshot, title: 'Os Sopranos', posterPath: '/novo.jpg' };

const item = (tmdbId: number, over: Partial<LibraryItem> = {}): LibraryItem => ({
  mediaType: 'tv',
  tmdbId,
  status: 'want',
  addedAt: T0,
  updatedAt: T0,
  watchedAt: null,
  snapshot,
  ...over,
});
const rating = (tmdbId: number, score: number, updatedAt: string): Rating => ({
  mediaType: 'tv',
  tmdbId,
  score,
  ratedAt: updatedAt,
  updatedAt,
});
const mark = (episodeNumber: number, watchedAt: string): EpisodeMark => ({
  tvId: 1398,
  seasonNumber: 1,
  episodeNumber,
  watchedAt,
});
const state = (over: Partial<LibraryState>): LibraryState => ({ ...EMPTY_LIBRARY, ...over });

/** Order-free view of a state. */
function canonical(s: LibraryState) {
  const by = <T>(key: (row: T) => string) => (a: T, b: T) => key(a).localeCompare(key(b));
  return {
    version: s.version,
    items: [...s.items].sort(by((i) => `${i.mediaType}:${i.tmdbId}`)),
    ratings: [...s.ratings].sort(by((r) => `${r.mediaType}:${r.tmdbId}`)),
    episodes: [...s.episodes].sort(by((e) => `${e.tvId}:${e.seasonNumber}:${String(e.episodeNumber).padStart(5, '0')}`)),
  };
}

describe('mergeLibraries', () => {
  it('keeps the whole item with the newest updatedAt (status, snapshot and dates together), either side', () => {
    const older = item(1398, { status: 'want', addedAt: T0, updatedAt: T0 });
    const newer = item(1398, { status: 'watched', addedAt: T1, updatedAt: T2, watchedAt: T2, snapshot: renamed });
    expect(mergeLibraries(state({ items: [older] }), state({ items: [newer] })).items).toEqual([newer]);
    expect(mergeLibraries(state({ items: [newer] }), state({ items: [older] })).items).toEqual([newer]);
  });

  it('keeps the account item on a tie', () => {
    const account = item(1398, { status: 'watching', updatedAt: T1 });
    const guest = item(1398, { status: 'want', updatedAt: T1, snapshot: renamed });
    expect(mergeLibraries(state({ items: [account] }), state({ items: [guest] })).items).toEqual([account]);
  });

  it('compares instants, not strings, across offsets', () => {
    const account = item(1398, { status: 'watching', updatedAt: T1 });
    const guest = item(1398, { status: 'watched', updatedAt: '2026-11-20T08:30:00.000-03:00' }); // 11:30Z
    expect(mergeLibraries(state({ items: [account] }), state({ items: [guest] })).items).toEqual([guest]);
  });

  it('keeps the rating with the newest updatedAt, either side, and the account one on a tie', () => {
    const account = rating(1398, 6, T1);
    expect(mergeLibraries(state({ ratings: [account] }), state({ ratings: [rating(1398, 9, T2)] })).ratings).toEqual([
      rating(1398, 9, T2),
    ]);
    expect(mergeLibraries(state({ ratings: [account] }), state({ ratings: [rating(1398, 3, T0)] })).ratings).toEqual([
      account,
    ]);
    expect(mergeLibraries(state({ ratings: [account] }), state({ ratings: [rating(1398, 3, T1)] })).ratings).toEqual([
      account,
    ]);
  });

  it('unites the episode marks, keeping the newest watchedAt of a mark on both sides', () => {
    const account = state({ episodes: [mark(1, T0), mark(2, T2)] });
    const guest = state({ episodes: [mark(2, T1), mark(3, T1), mark(1, T1)] });
    expect(canonical(mergeLibraries(account, guest)).episodes).toEqual([mark(1, T1), mark(2, T2), mark(3, T1)]);
  });

  it('unites titles and ratings found on one side only', () => {
    const account = state({ items: [item(1)], ratings: [rating(1, 7, T0)] });
    const guest = state({ items: [item(2, { mediaType: 'movie' })], ratings: [rating(2, 8, T0)] });
    const merged = canonical(mergeLibraries(account, guest));
    expect(merged.items).toEqual([item(2, { mediaType: 'movie' }), item(1)]); // sorted: movie before tv
    expect(merged.ratings).toEqual([rating(1, 7, T0), rating(2, 8, T0)]);
  });

  it('never drops a row of the account', () => {
    const account = state({
      items: [item(1), item(2, { updatedAt: T2 })],
      ratings: [rating(1, 7, T2)],
      episodes: [mark(1, T2), mark(2, T0)],
    });
    const guest = state({ items: [item(2)], ratings: [rating(1, 3, T0)], episodes: [mark(2, T1)] });
    const merged = mergeLibraries(account, guest);
    const has = <T>(rows: T[], key: (r: T) => string, wanted: T[]) =>
      wanted.every((w) => rows.some((r) => key(r) === key(w)));
    expect(has(merged.items, (i) => `${i.mediaType}:${i.tmdbId}`, account.items)).toBe(true);
    expect(has(merged.ratings, (r) => `${r.mediaType}:${r.tmdbId}`, account.ratings)).toBe(true);
    expect(has(merged.episodes, (e) => `${e.seasonNumber}:${e.episodeNumber}`, account.episodes)).toBe(true);
  });

  it('is idempotent: merging the same guest again changes nothing', () => {
    const account = state({
      items: [item(1, { updatedAt: T2 }), item(2)],
      ratings: [rating(1, 7, T0)],
      episodes: [mark(1, T0)],
    });
    const guest = state({
      items: [item(1, { status: 'watched', updatedAt: T1 }), item(2, { status: 'watching', updatedAt: T1 }), item(3)],
      ratings: [rating(1, 9, T1), rating(3, 4, T0)],
      episodes: [mark(1, T1), mark(2, T0)],
    });
    const once = mergeLibraries(account, guest);
    expect(mergeLibraries(once, guest)).toEqual(once);
  });

  it('an empty guest leaves the account unchanged', () => {
    const account = state({ items: [item(1), item(2)], ratings: [rating(1, 7, T0)], episodes: [mark(1, T0)] });
    expect(mergeLibraries(account, EMPTY_LIBRARY)).toEqual(account);
  });

  it('an empty account takes the whole guest library', () => {
    const guest = state({ items: [item(1)], ratings: [rating(1, 7, T0)], episodes: [mark(1, T0)] });
    expect(mergeLibraries(EMPTY_LIBRARY, guest)).toEqual(guest);
  });

  it('collapses duplicated keys inside either side, keeping the newest', () => {
    const account = state({ items: [item(1, { updatedAt: T0 }), item(1, { status: 'watched', updatedAt: T2 })] });
    const guest = state({ episodes: [mark(1, T0), mark(1, T1)] });
    const merged = mergeLibraries(account, guest);
    expect(merged.items).toEqual([item(1, { status: 'watched', updatedAt: T2 })]);
    expect(merged.episodes).toEqual([mark(1, T1)]);
  });

  it('does not change its inputs', () => {
    const account = state({ items: [item(1)], episodes: [mark(1, T0)] });
    const guest = state({ items: [item(1, { updatedAt: T1 })], episodes: [mark(1, T1)] });
    const copies = structuredClone([account, guest]);
    mergeLibraries(account, guest);
    expect([account, guest]).toEqual(copies);
  });
});
