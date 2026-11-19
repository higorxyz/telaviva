import type { Genre, MediaType } from '@/features/tmdb/types';
import { mediaTypeToTipo, parseIdFromSlug } from '@/lib/slug';

export type Tipo = 'filme' | 'serie';

/** The `tipo` URL segment as a TMDb media type; null for anything else (the page then 404s). */
export function mediaOfTipo(tipo: string): MediaType | null {
  return tipo === 'filme' ? 'movie' : tipo === 'serie' ? 'tv' : null;
}

export const tipoOf: (media: MediaType) => Tipo = mediaTypeToTipo;

/** Looks a genre up by the id in its `${id}-${slug}` segment; the name part is ignored (the page redirects to the canonical one). */
export function findGenre(genres: Genre[], slug: string): Genre | null {
  const id = parseIdFromSlug(slug);
  return id === null ? null : (genres.find((g) => g.id === id) ?? null);
}

/** Backdrop of the most popular title (results arrive sorted by popularity) that has one. */
export function pickBackdrop(results: { backdropPath: string | null }[]): string | null {
  return results.find((r) => r.backdropPath)?.backdropPath ?? null;
}

export function discoverEndpoint(tipo: Tipo, genreId: number): string {
  return `/api/discover?tipo=${tipo}&generos=${genreId}`;
}
