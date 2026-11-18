import type { RawMovie, RawPage, RawTv } from './schemas';
import type { MediaSummary, MediaType, Paginated } from './types';

export function toMediaSummary(raw: RawMovie | RawTv, mediaType: MediaType): MediaSummary {
  const base = {
    id: raw.id,
    mediaType,
    overview: raw.overview,
    posterPath: raw.poster_path,
    backdropPath: raw.backdrop_path,
    voteAverage: raw.vote_average,
    voteCount: raw.vote_count,
    popularity: raw.popularity,
    genreIds: raw.genre_ids,
    originalLanguage: raw.original_language,
  };
  if ('title' in raw) {
    return {
      ...base,
      title: raw.title,
      originalTitle: raw.original_title,
      releaseDate: raw.release_date || null,
    };
  }
  return {
    ...base,
    title: raw.name,
    originalTitle: raw.original_name,
    releaseDate: raw.first_air_date || null,
  };
}

export function toPaginated<R, T>(raw: RawPage<R>, map: (r: R) => T): Paginated<T> {
  return {
    page: raw.page,
    totalPages: raw.total_pages,
    totalResults: raw.total_results,
    results: raw.results.map(map),
  };
}

/** Uses the en-US text of `field` only when the pt-BR one is empty; a failing fallback keeps the original. */
export async function withTextFallback<K extends string, T extends Record<K, string>>(
  primary: T,
  field: K,
  fallback: () => Promise<Record<K, string>>,
): Promise<T> {
  if (primary[field].trim() !== '') return primary;
  try {
    const fallbackText = (await fallback())[field];
    return { ...primary, [field]: fallbackText };
  } catch {
    return primary;
  }
}

export function withOverviewFallback<T extends { overview: string }>(
  primary: T,
  fallback: () => Promise<{ overview: string }>,
): Promise<T> {
  return withTextFallback(primary, 'overview', fallback);
}
