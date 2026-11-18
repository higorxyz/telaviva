import type { MediaType } from '@/features/tmdb/types';
import type { DiscoverFilters } from './filters';
import { formatDecimal, formatVotes, languageLabel, type DiscoverCatalog } from './labels';

export interface FilterChip {
  key: string;
  label: string;
  /** The filters with this one removed. */
  next: DiscoverFilters;
}

const without = <K extends keyof DiscoverFilters>(f: DiscoverFilters, key: K): DiscoverFilters => {
  const next = { ...f };
  delete next[key];
  return next;
};

/** One chip per active filter (each genre and provider counts separately). Type and sort are not filters. */
export function activeChips(f: DiscoverFilters, catalog: DiscoverCatalog): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const id of f.genres) {
    const name = catalog.genres[f.media].find((g) => g.id === id)?.name ?? String(id);
    chips.push({ key: `g${id}`, label: `Gênero: ${name}`, next: { ...f, genres: f.genres.filter((g) => g !== id) } });
  }
  if (f.yearFrom !== undefined) chips.push({ key: 'de', label: `A partir de ${f.yearFrom}`, next: without(f, 'yearFrom') });
  if (f.yearTo !== undefined) chips.push({ key: 'ate', label: `Até ${f.yearTo}`, next: without(f, 'yearTo') });
  if (f.minRating !== undefined) chips.push({ key: 'nota', label: `Nota ${formatDecimal(f.minRating)}+`, next: without(f, 'minRating') });
  if (f.minVotes !== undefined) chips.push({ key: 'votos', label: `${formatVotes(f.minVotes)}+ votos`, next: without(f, 'minVotes') });
  if (f.maxRuntime !== undefined) chips.push({ key: 'duracao', label: `Até ${f.maxRuntime} min`, next: without(f, 'maxRuntime') });
  if (f.language) chips.push({ key: 'idioma', label: `Idioma: ${languageLabel(f.language)}`, next: without(f, 'language') });
  for (const id of f.providers) {
    const name = catalog.providers[f.media].find((p) => p.id === id)?.name ?? String(id);
    chips.push({ key: `p${id}`, label: `Provedor: ${name}`, next: { ...f, providers: f.providers.filter((p) => p !== id) } });
  }
  return chips;
}

export function clearFilters(f: DiscoverFilters): DiscoverFilters {
  return { media: f.media, genres: [], providers: [], sort: f.sort };
}

/** Changes the media type, dropping genres/providers/runtime that do not exist for the new type. */
export function switchMedia(f: DiscoverFilters, media: MediaType, catalog: DiscoverCatalog): DiscoverFilters {
  if (f.media === media) return f;
  const next: DiscoverFilters = {
    ...f,
    media,
    genres: f.genres.filter((id) => catalog.genres[media].some((g) => g.id === id)),
    providers: f.providers.filter((id) => catalog.providers[media].some((p) => p.id === id)),
  };
  if (media === 'tv') delete next.maxRuntime;
  if (media === 'tv' && next.sort === 'bilheteria') next.sort = 'popularidade';
  return next;
}
