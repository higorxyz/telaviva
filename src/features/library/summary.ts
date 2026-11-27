import type { MediaSummary } from '../tmdb/types';
import { episodeCode, type EpisodeRef } from './progress';
import type { LibraryItem } from './types';

/** A minimal summary built from the saved snapshot, so lists and rails never call TMDb for their posters. */
export function toSummary(item: LibraryItem): MediaSummary {
  return {
    id: item.tmdbId,
    mediaType: item.mediaType,
    title: item.snapshot.title,
    originalTitle: item.snapshot.title,
    overview: '',
    posterPath: item.snapshot.posterPath,
    backdropPath: null,
    voteAverage: 0,
    voteCount: 0,
    popularity: 0,
    releaseDate: item.snapshot.releaseDate,
    genreIds: item.snapshot.genreIds,
    originalLanguage: '',
  };
}

/** "Próximo: T{s}E{e}", plus " · {nome}" when the episode name is known. */
export function nextEpisodeLabel(next: EpisodeRef, name?: string | null): string {
  return `Próximo: ${episodeCode(next)}${name ? ` · ${name}` : ''}`;
}
