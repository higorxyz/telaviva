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

/**
 * One cover per genre, never the same title twice: walking the genres in display order, each takes its most
 * popular title with a backdrop that no earlier genre already took (so a hit that tops Drama and Suspense covers
 * only the first, and the second shows its next title). Falls back to a repeat only when every candidate is taken.
 */
export function pickDistinctBackdrops(pages: ({ id: number; backdropPath: string | null }[] | null)[]): (string | null)[] {
  const used = new Set<number>();
  return pages.map((results) => {
    if (!results) return null;
    const pick = results.find((r) => r.backdropPath && !used.has(r.id));
    if (pick) used.add(pick.id);
    return pick?.backdropPath ?? pickBackdrop(results);
  });
}

export function discoverEndpoint(tipo: Tipo, genreId: number): string {
  return `/api/discover?tipo=${tipo}&generos=${genreId}`;
}
