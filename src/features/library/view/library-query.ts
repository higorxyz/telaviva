import type { MediaType } from '../../tmdb/types';
import { findRating } from '../commands';
import type { LibraryItem, LibraryState } from '../types';

export type LibraryTab = 'assistindo' | 'quero-ver' | 'assistidos';
export type LibraryOrder = 'recentes' | 'titulo' | 'nota' | 'ano';
export interface LibraryQuery {
  aba: LibraryTab;
  tipo: MediaType | null;
  ordem: LibraryOrder;
}

export const TABS: LibraryTab[] = ['assistindo', 'quero-ver', 'assistidos'];
const ORDERS: LibraryOrder[] = ['recentes', 'titulo', 'nota', 'ano'];
const TYPE_PARAM: Record<MediaType, string> = { movie: 'filme', tv: 'serie' };

export const defaultTab = (hasWatching: boolean): LibraryTab => (hasWatching ? 'assistindo' : 'quero-ver');

export function parseLibraryQuery(params: URLSearchParams, hasWatching: boolean): LibraryQuery {
  const aba = params.get('aba');
  const ordem = params.get('ordem');
  const tipo = params.get('tipo');
  return {
    aba: TABS.find((t) => t === aba) ?? defaultTab(hasWatching),
    tipo: tipo === 'filme' ? 'movie' : tipo === 'serie' ? 'tv' : null,
    ordem: ORDERS.find((o) => o === ordem) ?? 'recentes',
  };
}

/** Query string without the defaults. The default tab depends on whether a series is in progress. */
export function toLibrarySearch(q: LibraryQuery, hasWatching = false): string {
  const out = new URLSearchParams();
  if (q.aba !== defaultTab(hasWatching)) out.set('aba', q.aba);
  if (q.tipo) out.set('tipo', TYPE_PARAM[q.tipo]);
  if (q.ordem !== 'recentes') out.set('ordem', q.ordem);
  return out.toString();
}

const STATUS_OF: Record<LibraryTab, LibraryItem['status']> = {
  assistindo: 'watching',
  'quero-ver': 'want',
  assistidos: 'watched',
};

/** Missing values (null) always go last, whatever the direction. */
const byNumberDesc = (a: number | null, b: number | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : b - a;

const yearOf = (item: LibraryItem): number | null => {
  const y = Number(item.snapshot.releaseDate?.slice(0, 4));
  return Number.isInteger(y) && y > 0 ? y : null;
};

export function selectItems(state: LibraryState, q: LibraryQuery): LibraryItem[] {
  const items = state.items.filter(
    (i) => i.status === STATUS_OF[q.aba] && (q.aba === 'assistindo' || !q.tipo || i.mediaType === q.tipo),
  );
  const score = (i: LibraryItem) => findRating(state, i)?.score ?? null;
  const compare: Record<LibraryOrder, (a: LibraryItem, b: LibraryItem) => number> = {
    recentes: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    titulo: (a, b) => a.snapshot.title.localeCompare(b.snapshot.title, 'pt-BR'),
    nota: (a, b) => byNumberDesc(score(a), score(b)),
    ano: (a, b) => byNumberDesc(yearOf(a), yearOf(b)),
  };
  return items.sort(compare[q.ordem]);
}

export interface LibraryStats {
  moviesWatched: number;
  seriesWatched: number;
  seriesWatching: number;
  episodesWatched: number;
  wantCount: number;
  averageScore: number | null;
}

export function libraryStats(state: LibraryState): LibraryStats {
  const count = (type: MediaType | null, status: LibraryItem['status']) =>
    state.items.filter((i) => i.status === status && (!type || i.mediaType === type)).length;
  const scores = state.ratings.map((r) => r.score);
  return {
    moviesWatched: count('movie', 'watched'),
    seriesWatched: count('tv', 'watched'),
    seriesWatching: count('tv', 'watching'),
    episodesWatched: state.episodes.filter((e) => e.seasonNumber > 0).length,
    wantCount: count(null, 'want'),
    averageScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
  };
}
