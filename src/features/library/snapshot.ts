import type { MediaSummary } from '../tmdb/types';
import type { TitleSnapshot } from './types';

/** TMDb can send an empty title; the saved library requires one, so it gets a neutral name instead. */
export const UNTITLED = 'Sem título';

export function toSnapshot(
  m: Pick<MediaSummary, 'title' | 'posterPath' | 'releaseDate' | 'genreIds'>,
): TitleSnapshot {
  return {
    title: m.title.trim() ? m.title : UNTITLED,
    posterPath: m.posterPath,
    releaseDate: m.releaseDate,
    genreIds: [...m.genreIds],
  };
}
