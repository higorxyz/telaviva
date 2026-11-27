import { parseFilters, toTmdbParams } from '@/features/discover/filters';
import { discover } from '@/features/tmdb/discover';
import { getGenres } from '@/features/tmdb/genres';
import { tmdbImage } from '@/features/tmdb/images';
import type { MediaType } from '@/features/tmdb/types';
import { genreHref } from '@/lib/slug';
import type { GenreCardData } from './GenreTabs';
import { pickDistinctBackdrops, tipoOf } from './genres';

/**
 * One card per genre; backdrop = the genre's most popular title (page 1 of the cached discover, with the default
 * Descobrir filters, so only titles available in Brazil) that no earlier card already uses, so the grid never
 * repeats a cover. A failing genre just loses its image.
 */
export async function loadGenreCards(media: MediaType): Promise<GenreCardData[]> {
  const genres = await getGenres(media);
  const pages = await Promise.all(
    genres.map((g) =>
      discover(media, toTmdbParams(parseFilters(new URLSearchParams({ tipo: tipoOf(media), generos: String(g.id) }))), 1)
        .then((page) => page.results)
        .catch(() => null),
    ),
  );
  const backdrops = pickDistinctBackdrops(pages);
  return genres.map((g, i) => ({
    id: g.id,
    name: g.name,
    href: genreHref({ mediaType: media, id: g.id, name: g.name }),
    backdrop: tmdbImage(backdrops[i] ?? null, 'w500'),
  }));
}
