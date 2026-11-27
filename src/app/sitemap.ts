import type { MetadataRoute } from 'next';
import { CATALOG_LIST_META } from '@/features/catalog/list-ids';
import { getGenres } from '@/features/tmdb/genres';
import { env } from '@/lib/env';
import { genreHref } from '@/lib/slug';

/** The pages with fixed content: the home page and the hubs of the tab bar. */
const FIXED = ['/', '/filmes', '/series', '/descobrir', '/generos'];

/**
 * The fixed pages, every catalog list (`/filmes/[lista]`, `/series/[lista]`) and every genre page: the pages that
 * exist for everyone and change only in what they list. No per-title page (tens of thousands, found through the
 * links), no account, sign-in, search or personal page. The genres come from the same cached lists that prerender the
 * genre pages, so the sitemap is built with them.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = new URL(env.SITE_URL).origin;
  const [movie, tv] = await Promise.all([getGenres('movie'), getGenres('tv')]);
  const paths = [
    ...FIXED,
    ...Object.keys(CATALOG_LIST_META).map((id) => `/${id}`),
    ...movie.map((g) => genreHref({ mediaType: 'movie', ...g })),
    ...tv.map((g) => genreHref({ mediaType: 'tv', ...g })),
  ];
  return paths.map((path) => ({ url: path === '/' ? origin : `${origin}${path}` }));
}
