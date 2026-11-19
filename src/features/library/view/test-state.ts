import type { EpisodeMark, LibraryItem, LibraryState, LibraryStatus, Rating } from '../types';
import { EMPTY_LIBRARY } from '../types';

const T0 = '2026-11-01T12:00:00.000Z';

export function entry(
  mediaType: 'movie' | 'tv',
  tmdbId: number,
  status: LibraryStatus,
  o: { title?: string; releaseDate?: string | null; updatedAt?: string } = {},
): LibraryItem {
  return {
    mediaType,
    tmdbId,
    status,
    addedAt: T0,
    updatedAt: o.updatedAt ?? T0,
    watchedAt: status === 'watched' ? T0 : null,
    snapshot: {
      title: o.title ?? `Titulo ${tmdbId}`,
      posterPath: null,
      releaseDate: o.releaseDate === undefined ? '2020-05-01' : o.releaseDate,
      genreIds: [],
    },
  };
}

export const rating = (mediaType: 'movie' | 'tv', tmdbId: number, score: number): Rating => ({
  mediaType, tmdbId, score, ratedAt: T0, updatedAt: T0,
});

export const mark = (tvId: number, seasonNumber: number, episodeNumber: number): EpisodeMark => ({
  tvId, seasonNumber, episodeNumber, watchedAt: T0,
});

export const stateOf = (p: Partial<LibraryState>): LibraryState => ({ ...EMPTY_LIBRARY, ...p });
