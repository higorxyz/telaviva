import type { DiscoverFilters } from './filters';
import { formatScore } from './labels';

// Pure helpers behind the discover toolbar: presets, quick picks and the trigger summaries.

export type Dimension = 'generos' | 'ano' | 'nota' | 'duracao' | 'provedores' | 'mais';

type Patch = Partial<Omit<DiscoverFilters, 'media' | 'genres' | 'providers'>>;

/** A toggle that is "on" while the filters match `on`; turning it off applies `off`. */
export interface FilterToggle {
  id: string;
  label: string;
  on: Patch;
  off: Patch;
  /** Hidden for series (runtime is a movie-only filter). */
  movieOnly?: boolean;
}

const NO_YEARS: Patch = { yearFrom: undefined, yearTo: undefined };

export function presets(year: number): FilterToggle[] {
  return [
    {
      id: 'aclamados',
      label: 'Aclamados',
      on: { minRating: 8, minVotes: 1000, sort: 'nota' },
      off: { minRating: undefined, minVotes: undefined, sort: 'popularidade' },
    },
    { id: 'curtos', label: 'Curtos', on: { maxRuntime: 100, minVotes: 100 }, off: { maxRuntime: undefined, minVotes: undefined }, movieOnly: true },
    { id: 'lancamentos', label: `Lançamentos ${year}`, on: { yearFrom: year, yearTo: year }, off: NO_YEARS },
  ];
}

export function yearPicks(year: number): FilterToggle[] {
  return [
    { id: 'este-ano', label: 'Este ano', on: { yearFrom: year, yearTo: year }, off: NO_YEARS },
    { id: 'anos-2010', label: 'Anos 2010', on: { yearFrom: 2010, yearTo: 2019 }, off: NO_YEARS },
    { id: 'anos-2000', label: 'Anos 2000', on: { yearFrom: 2000, yearTo: 2009 }, off: NO_YEARS },
    { id: 'classicos', label: 'Clássicos (antes de 1980)', on: { yearFrom: undefined, yearTo: 1979 }, off: NO_YEARS },
  ];
}

export function isOn(f: DiscoverFilters, t: FilterToggle): boolean {
  return (Object.keys(t.on) as Array<keyof Patch>).every((k) => f[k] === t.on[k]);
}

/** Merges a patch, dropping keys set to undefined (filters never hold explicit undefineds). */
export function withPatch(f: DiscoverFilters, patch: Patch): DiscoverFilters {
  const next: DiscoverFilters = { ...f, ...patch };
  for (const k of Object.keys(patch) as Array<keyof Patch>) if (next[k] === undefined) delete next[k];
  return next;
}

export function flip(f: DiscoverFilters, t: FilterToggle): DiscoverFilters {
  return withPatch(f, isOn(f, t) ? t.off : t.on);
}

export const RATING_STEPS = [6, 7, 8] as const;
export const RUNTIME_STEPS = [90, 120] as const;

function yearSummary(from?: number, to?: number): string | null {
  if (from !== undefined && to !== undefined) return from === to ? String(from) : `${from}–${to}`;
  if (from !== undefined) return `desde ${from}`;
  if (to !== undefined) return `até ${to}`;
  return null;
}

/** Short state shown on a trigger ("Gêneros · 2", "Ano · 2010–2019"), or null when the dimension is unset. */
export function summary(dim: Dimension, f: DiscoverFilters): string | null {
  switch (dim) {
    case 'generos':
      return f.genres.length ? String(f.genres.length) : null;
    case 'ano':
      return yearSummary(f.yearFrom, f.yearTo);
    case 'nota':
      return f.minRating !== undefined ? `${formatScore(f.minRating)}+` : null;
    case 'duracao':
      return f.maxRuntime !== undefined ? `até ${f.maxRuntime} min` : null;
    case 'provedores':
      return f.providers.length ? String(f.providers.length) : null;
    case 'mais': {
      const set = [f.language, f.minVotes].filter((v) => v !== undefined).length;
      return set ? String(set) : null;
    }
  }
}

/** The filters with one dimension reset (each popover's "Limpar"). */
export function clearDimension(dim: Dimension, f: DiscoverFilters): DiscoverFilters {
  switch (dim) {
    case 'generos':
      return { ...f, genres: [] };
    case 'provedores':
      return { ...f, providers: [] };
    case 'ano':
      return withPatch(f, NO_YEARS);
    case 'nota':
      return withPatch(f, { minRating: undefined });
    case 'duracao':
      return withPatch(f, { maxRuntime: undefined });
    case 'mais':
      return withPatch(f, { language: undefined, minVotes: undefined });
  }
}
