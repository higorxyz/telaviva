import 'server-only';
import { getMovieList, getTrending } from '@/features/tmdb/movies';
import { getTvList } from '@/features/tmdb/tv';
import type { MediaSummary, Paginated } from '@/features/tmdb/types';
import { CATALOG_LIST_META, type CatalogListId, type CatalogListMeta } from './list-ids';
import { fetchFilledPage, fetchRailPage } from './post-filter-pages';

export type { CatalogListId };

type Fetcher = (page: number) => Promise<Paginated<MediaSummary>>;

const fetchers: Record<CatalogListId, Fetcher> = {
  'filmes/em-alta': (p) => getTrending('movie', 'week', p),
  'filmes/em-cartaz': (p) => getMovieList('now_playing', p),
  'filmes/populares': (p) => getMovieList('popular', p),
  'filmes/mais-bem-avaliados': (p) => getMovieList('top_rated', p),
  'filmes/em-breve': (p) => getMovieList('upcoming', p),
  'filmes/joias-escondidas': (p) => getMovieList('hidden_gems', p),
  'filmes/curtos': (p) => getMovieList('short', p),
  'filmes/blockbusters': (p) => getMovieList('blockbusters', p),
  'filmes/no-streaming': (p) => getMovieList('streaming_br', p),
  'series/em-alta': (p) => getTrending('tv', 'week', p),
  'series/no-ar-hoje': (p) => getTvList('airing_today', p),
  'series/em-exibicao': (p) => getTvList('on_the_air', p),
  'series/populares': (p) => getTvList('popular', p),
  'series/mais-bem-avaliadas': (p) => getTvList('top_rated', p),
};

/**
 * Lists with no watch filter on TMDb's side, so their pages are filtered to titles available in Brazil after the
 * fact and can come back short or empty. Discover lists ask TMDb directly; "em cartaz" and "em breve" are exempt.
 */
const POST_FILTERED = new Set<CatalogListId>([
  'filmes/em-alta',
  'filmes/populares',
  'series/em-alta',
  'series/no-ar-hoje',
  'series/em-exibicao',
  'series/populares',
]);

export interface CatalogList extends CatalogListMeta {
  postFiltered: boolean;
  /** One page for the list page and its infinite scroll; a post-filtered list skips empty pages (see `page`). */
  fetch: Fetcher;
  /** Page 1 for a hub rail; a post-filtered list tops it up with page 2 when short. */
  fetchRail: () => Promise<Paginated<MediaSummary>>;
}

function catalogList(id: CatalogListId): CatalogList {
  const raw = fetchers[id];
  const postFiltered = POST_FILTERED.has(id);
  return {
    ...CATALOG_LIST_META[id],
    postFiltered,
    fetch: postFiltered ? (page) => fetchFilledPage(raw, page) : raw,
    fetchRail: postFiltered ? () => fetchRailPage(raw) : () => raw(1),
  };
}

export const CATALOG_LISTS = Object.fromEntries(
  (Object.keys(CATALOG_LIST_META) as CatalogListId[]).map((id) => [id, catalogList(id)]),
) as Record<CatalogListId, CatalogList>;
