import type { LibraryState, TitleRef } from './types';

/**
 * What an undo expects to find for one title: everything it would overwrite. If any part differs on the server,
 * another device changed the title after the action, and the undo is refused instead of erasing that change.
 */
export interface TitleFingerprint {
  itemUpdatedAt: string | null;
  ratingUpdatedAt: string | null;
  /** Episode marks of the series (always 0 for a movie). */
  markCount: number;
  latestMarkAt: string | null;
}

const same = (a: TitleRef, b: TitleRef) => a.mediaType === b.mediaType && a.tmdbId === b.tmdbId;

export function titleFingerprint(state: LibraryState, ref: TitleRef): TitleFingerprint {
  const marks = ref.mediaType === 'tv' ? state.episodes.filter((e) => e.tvId === ref.tmdbId) : [];
  let latest: string | null = null;
  for (const mark of marks) {
    if (latest === null || Date.parse(mark.watchedAt) > Date.parse(latest)) latest = mark.watchedAt;
  }
  return {
    itemUpdatedAt: state.items.find((i) => same(i, ref))?.updatedAt ?? null,
    ratingUpdatedAt: state.ratings.find((r) => same(r, ref))?.updatedAt ?? null,
    markCount: marks.length,
    latestMarkAt: latest,
  };
}

/** Timestamps compare as instants, so the same moment written in another offset still matches. */
const sameInstant = (a: string | null, b: string | null) =>
  a === null || b === null ? a === b : Date.parse(a) === Date.parse(b);

export function sameFingerprint(a: TitleFingerprint, b: TitleFingerprint): boolean {
  return (
    sameInstant(a.itemUpdatedAt, b.itemUpdatedAt) &&
    sameInstant(a.ratingUpdatedAt, b.ratingUpdatedAt) &&
    a.markCount === b.markCount &&
    sameInstant(a.latestMarkAt, b.latestMarkAt)
  );
}
