import type { TmdbParams } from '@/features/tmdb/client';
import type { MediaType } from '@/features/tmdb/types';

// Pure and client-safe: TmdbParams is a type-only import (erased), nothing server-only runs here.

export type DiscoverSort = 'popularidade' | 'nota' | 'lancamento' | 'bilheteria' | 'titulo';

export interface DiscoverFilters {
  media: MediaType;
  genres: number[];
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  minVotes?: number;
  maxRuntime?: number;
  language?: string;
  providers: number[];
  sort: DiscoverSort;
}

export const SORTS: readonly DiscoverSort[] = ['popularidade', 'nota', 'lancamento', 'bilheteria', 'titulo'];
export const RUNTIME_MIN = 40;
export const RUNTIME_MAX = 400;
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;
const RATING_SORT_MIN_VOTES = 200;

function intList(raw: string | null): number[] {
  if (!raw) return [];
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map(Number)
    .filter((n) => n > 0);
  return [...new Set(ids)];
}

function num(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const snap = (n: number, step: number) => Math.round(n / step) * step;
const year = (y?: number) => (y === undefined ? undefined : clamp(Math.round(y), YEAR_MIN, YEAR_MAX));

export function parseFilters(sp: URLSearchParams): DiscoverFilters {
  const media: MediaType = sp.get('tipo') === 'serie' ? 'tv' : 'movie';
  const sortRaw = sp.get('ordem');
  const parsedSort = SORTS.find((s) => s === sortRaw) ?? 'popularidade';
  // Series have no box office: the select does not offer it, so state must not hold it either.
  const sort = media === 'tv' && parsedSort === 'bilheteria' ? 'popularidade' : parsedSort;

  let yearFrom = year(num(sp.get('de')));
  let yearTo = year(num(sp.get('ate')));
  if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];

  const rating = num(sp.get('nota'));
  const minRating = rating === undefined ? undefined : snap(clamp(rating, 0, 10), 0.5) || undefined;

  const votes = num(sp.get('votos'));
  const minVotes = votes === undefined ? undefined : Math.floor(Math.max(0, votes)) || undefined;

  const runtime = num(sp.get('duracao'));
  const maxRuntime =
    media === 'movie' && runtime !== undefined ? snap(clamp(runtime, RUNTIME_MIN, RUNTIME_MAX), 5) : undefined;

  const lang = sp.get('idioma')?.toLowerCase();
  const language = lang && /^[a-z]{2}$/.test(lang) ? lang : undefined;

  const f: DiscoverFilters = { media, genres: intList(sp.get('generos')), providers: intList(sp.get('provedores')), sort };
  if (yearFrom !== undefined) f.yearFrom = yearFrom;
  if (yearTo !== undefined) f.yearTo = yearTo;
  if (minRating !== undefined) f.minRating = minRating;
  if (minVotes !== undefined) f.minVotes = minVotes;
  if (maxRuntime !== undefined) f.maxRuntime = maxRuntime;
  if (language) f.language = language;
  return f;
}

/** Omits defaults; param order is stable so equal filters give equal strings (used as keys). */
export function filtersToSearchParams(f: DiscoverFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.media === 'tv') sp.set('tipo', 'serie');
  if (f.genres.length) sp.set('generos', f.genres.join(','));
  if (f.yearFrom !== undefined) sp.set('de', String(f.yearFrom));
  if (f.yearTo !== undefined) sp.set('ate', String(f.yearTo));
  if (f.minRating !== undefined) sp.set('nota', String(f.minRating));
  if (f.minVotes !== undefined) sp.set('votos', String(f.minVotes));
  if (f.media === 'movie' && f.maxRuntime !== undefined) sp.set('duracao', String(f.maxRuntime));
  if (f.language) sp.set('idioma', f.language);
  if (f.providers.length) sp.set('provedores', f.providers.join(','));
  if (f.sort !== 'popularidade') sp.set('ordem', f.sort);
  return sp;
}

const MOVIE_SORT: Record<DiscoverSort, string> = {
  popularidade: 'popularity.desc',
  nota: 'vote_average.desc',
  lancamento: 'primary_release_date.desc',
  bilheteria: 'revenue.desc',
  titulo: 'title.asc',
};

const TV_SORT: Record<DiscoverSort, string> = {
  popularidade: 'popularity.desc',
  nota: 'vote_average.desc',
  lancamento: 'first_air_date.desc',
  bilheteria: 'popularity.desc',
  titulo: 'name.asc',
};

export function toTmdbParams(f: DiscoverFilters): TmdbParams {
  const movie = f.media === 'movie';
  const dateKey = movie ? 'primary_release_date' : 'first_air_date';
  const p: TmdbParams = { sort_by: (movie ? MOVIE_SORT : TV_SORT)[f.sort], include_adult: false };
  if (f.genres.length) p.with_genres = f.genres.join(',');
  if (f.yearFrom !== undefined) p[`${dateKey}.gte`] = `${f.yearFrom}-01-01`;
  if (f.yearTo !== undefined) p[`${dateKey}.lte`] = `${f.yearTo}-12-31`;
  if (f.minRating !== undefined) p['vote_average.gte'] = f.minRating;
  const votes = f.minVotes ?? (f.sort === 'nota' ? RATING_SORT_MIN_VOTES : undefined);
  if (votes !== undefined) p['vote_count.gte'] = votes;
  if (movie && f.maxRuntime !== undefined) p['with_runtime.lte'] = f.maxRuntime;
  if (f.language) p.with_original_language = f.language;
  if (f.providers.length) {
    p.with_watch_providers = f.providers.join('|');
    p.watch_region = 'BR';
  }
  return p;
}
