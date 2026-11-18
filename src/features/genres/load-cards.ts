import { discover } from '@/features/tmdb/discover';
import { getGenres } from '@/features/tmdb/genres';
import { tmdbImage } from '@/features/tmdb/images';
import type { MediaType } from '@/features/tmdb/types';
import { genreHref } from '@/lib/slug';
import type { GenreCardData } from './GenreTabs';
import { pickBackdrop } from './genres';

/** One card per genre; backdrop = most popular title of the genre (page 1 of the cached discover). A failing genre just loses its image. */
export async function loadGenreCards(media: MediaType): Promise<GenreCardData[]> {
  const genres = await getGenres(media);
  return Promise.all(
    genres.map(async (g) => {
      const page = await discover(media, { with_genres: String(g.id), sort_by: 'popularity.desc' }).catch(() => null);
      return {
        id: g.id,
        name: g.name,
        href: genreHref({ mediaType: media, id: g.id, name: g.name }),
        backdrop: tmdbImage(page ? pickBackdrop(page.results) : null, 'w500'),
      };
    }),
  );
}
