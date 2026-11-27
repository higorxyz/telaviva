import { describe, expect, it } from 'vitest';
import { applyCommand, findItem } from './commands';
import { airedEpisodes, type TvProgressInfo } from './progress';
import { EMPTY_LIBRARY, type LibraryState, type TitleSnapshot } from './types';

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-02-01T00:00:00.000Z';
const T2 = '2026-03-01T00:00:00.000Z';
const ref = { mediaType: 'tv', tmdbId: 7 } as const;
const snapshot: TitleSnapshot = { title: 'Série', posterPath: null, releaseDate: null, genreIds: [] };

const progress = (over: Partial<TvProgressInfo> = {}): TvProgressInfo => ({
  tvId: 7,
  ended: false,
  seasons: [{ seasonNumber: 1, episodeCount: 3 }],
  lastAired: { seasonNumber: 1, episodeNumber: 3 },
  nextToAir: null,
  ...over,
});

const mark = (state: LibraryState, eps: [number, number][], watched: boolean, now: string, p = progress()) =>
  applyCommand(
    state,
    {
      type: 'setEpisodes',
      tvId: 7,
      marks: eps.map(([seasonNumber, episodeNumber]) => ({ seasonNumber, episodeNumber })),
      watched,
      snapshot,
      progress: p,
    },
    now,
  );

const allAired = (p: TvProgressInfo) =>
  airedEpisodes(p).map((r) => [r.seasonNumber, r.episodeNumber] as [number, number]);

describe('setEpisodes', () => {
  it('creates the item as watching when the series is not in the library', () => {
    const s = mark(EMPTY_LIBRARY, [[1, 1]], true, T0);
    expect(findItem(s, ref)).toMatchObject({ status: 'watching', addedAt: T0, updatedAt: T0, snapshot });
    expect(s.episodes).toEqual([{ tvId: 7, seasonNumber: 1, episodeNumber: 1, watchedAt: T0 }]);
  });

  it('moves want to watching', () => {
    const want = applyCommand(EMPTY_LIBRARY, { type: 'setStatus', ref, status: 'want', snapshot }, T0);
    expect(findItem(mark(want, [[1, 1]], true, T1), ref)?.status).toBe('watching');
  });

  it('finishes an ended series and goes back to watching on unmark', () => {
    const p = progress({ ended: true });
    const done = mark(EMPTY_LIBRARY, allAired(p), true, T0, p);
    expect(findItem(done, ref)).toMatchObject({ status: 'watched', watchedAt: T0 });
    const back = mark(done, [[1, 2]], false, T1, p);
    expect(findItem(back, ref)).toMatchObject({ status: 'watching', watchedAt: null });
  });

  it('keeps watching when all aired episodes of an ongoing series are marked', () => {
    expect(findItem(mark(EMPTY_LIBRARY, allAired(progress()), true, T0), ref)?.status).toBe('watching');
  });

  it('re-marking only updates watchedAt, and unmarking removes just the listed marks', () => {
    let s = mark(EMPTY_LIBRARY, [[1, 1], [1, 2]], true, T0);
    s = mark(s, [[1, 1]], true, T1);
    expect(s.episodes).toHaveLength(2);
    expect(s.episodes.find((e) => e.episodeNumber === 1)?.watchedAt).toBe(T1);
    expect(s.episodes.find((e) => e.episodeNumber === 2)?.watchedAt).toBe(T0);
    s = mark(s, [[1, 1]], false, T2);
    expect(s.episodes.map((e) => e.episodeNumber)).toEqual([2]);
  });

  it('keeps watching after unmarking everything', () => {
    let s = mark(EMPTY_LIBRARY, [[1, 1]], true, T0);
    s = mark(s, [[1, 1]], false, T1);
    expect(s.episodes).toEqual([]);
    expect(findItem(s, ref)?.status).toBe('watching');
  });

  it('does not create an item when only unmarking', () => {
    expect(mark(EMPTY_LIBRARY, [[1, 1]], false, T0).items).toEqual([]);
  });
});

describe('setStatus for series with progress', () => {
  it('watched marks every aired regular episode', () => {
    const s = applyCommand(
      EMPTY_LIBRARY,
      { type: 'setStatus', ref, status: 'watched', snapshot, progress: progress() },
      T0,
    );
    expect(s.episodes).toHaveLength(3);
    expect(findItem(s, ref)).toMatchObject({ status: 'watched', watchedAt: T0 });
  });

  it('want keeps the marks', () => {
    const watching = mark(EMPTY_LIBRARY, [[1, 1]], true, T0);
    const s = applyCommand(watching, { type: 'setStatus', ref, status: 'want', snapshot, progress: progress() }, T1);
    expect(s.episodes).toHaveLength(1);
    expect(findItem(s, ref)?.status).toBe('want');
  });
});
