import type { MediaType } from '../tmdb/types';

export type LibraryStatus = 'want' | 'watching' | 'watched';

/** Minimal copy of a title, so lists render without calling TMDb. */
export interface TitleSnapshot {
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  genreIds: number[];
}

export interface LibraryItem {
  mediaType: MediaType;
  tmdbId: number;
  status: LibraryStatus;
  addedAt: string;
  updatedAt: string;
  watchedAt: string | null;
  snapshot: TitleSnapshot;
}

export interface EpisodeMark {
  tvId: number;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: string;
}

export interface Rating {
  mediaType: MediaType;
  tmdbId: number;
  /** Integer from 1 to 10. */
  score: number;
  ratedAt: string;
  updatedAt: string;
}

export interface LibraryState {
  version: 1;
  items: LibraryItem[];
  episodes: EpisodeMark[];
  ratings: Rating[];
}

export const EMPTY_LIBRARY: LibraryState = { version: 1, items: [], episodes: [], ratings: [] };

export type TitleRef = { mediaType: MediaType; tmdbId: number };
