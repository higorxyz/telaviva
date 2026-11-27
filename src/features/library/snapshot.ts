import type { MediaSummary } from '../tmdb/types';
import { PG_INT_MAX, SNAPSHOT_LIMITS } from './limits';
import type { TitleSnapshot } from './types';

/** TMDb can send an empty title; the saved library requires one, so it gets a neutral name instead. */
export const UNTITLED = 'Sem título';

/** At most `max` UTF-16 units, never ending in half of an emoji (a lone high surrogate). */
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  return /[\uD800-\uDBFF]$/.test(head) ? head.slice(0, -1) : head;
}

/**
 * Brings a snapshot within SNAPSHOT_LIMITS instead of letting the library refuse it: a long title is cut, a poster
 * path that cannot be TMDb's is dropped, a date keeps its YYYY-MM-DD part, and only valid genre ids are kept.
 * Nothing else changes (an empty title stays empty).
 */
export function trimSnapshot(s: TitleSnapshot): TitleSnapshot {
  return {
    title: cut(s.title, SNAPSHOT_LIMITS.title),
    posterPath: s.posterPath !== null && s.posterPath.length <= SNAPSHOT_LIMITS.posterPath ? s.posterPath : null,
    releaseDate: s.releaseDate === null ? null : s.releaseDate.slice(0, SNAPSHOT_LIMITS.releaseDate),
    genreIds: s.genreIds
      .filter((g) => Number.isInteger(g) && g >= 1 && g <= PG_INT_MAX)
      .slice(0, SNAPSHOT_LIMITS.genreIds),
  };
}

/** A snapshot the library always accepts: trimmed to the limits, and named "Sem título" when TMDb sent no title. */
export function fitSnapshot(s: TitleSnapshot): TitleSnapshot {
  return trimSnapshot({ ...s, title: s.title.trim() ? s.title : UNTITLED });
}

export function toSnapshot(
  m: Pick<MediaSummary, 'title' | 'posterPath' | 'releaseDate' | 'genreIds'>,
): TitleSnapshot {
  return fitSnapshot({ title: m.title, posterPath: m.posterPath, releaseDate: m.releaseDate, genreIds: [...m.genreIds] });
}
