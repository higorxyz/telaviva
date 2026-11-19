import type { MediaSummary } from '../tmdb/types';
import type { TitleSnapshot } from './types';

export function toSnapshot(
  m: Pick<MediaSummary, 'title' | 'posterPath' | 'releaseDate' | 'genreIds'>,
): TitleSnapshot {
  return {
    title: m.title,
    posterPath: m.posterPath,
    releaseDate: m.releaseDate,
    genreIds: [...m.genreIds],
  };
}
