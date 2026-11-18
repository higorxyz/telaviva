import 'server-only';
import { getMovieList, getTrending } from '@/features/tmdb/movies';
import { getTvList } from '@/features/tmdb/tv';
import type { MediaSummary, Paginated } from '@/features/tmdb/types';
import { CATALOG_LIST_META, type CatalogListId, type CatalogListMeta } from './list-ids';

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

export const CATALOG_LISTS = Object.fromEntries(
  (Object.keys(CATALOG_LIST_META) as CatalogListId[]).map((id) => [
    id,
    { ...CATALOG_LIST_META[id], fetch: fetchers[id] },
  ]),
) as Record<CatalogListId, CatalogListMeta & { fetch: Fetcher }>;
