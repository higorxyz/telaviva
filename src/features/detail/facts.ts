import type { ReactNode } from 'react';
import type { MovieDetails, TvDetails } from '@/features/tmdb/types';
import { formatDate } from '@/lib/format';
import { statusLabel } from './seasons';

const languageNames = new Intl.DisplayNames(['pt-BR'], { type: 'language' });
const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function languageName(code: string): string {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Ficha técnica rows; budget and revenue only when TMDb has a figure. */
export function movieFacts(movie: MovieDetails): Array<{ label: string; value: ReactNode }> {
  const facts: Array<{ label: string; value: ReactNode | null }> = [
    { label: 'Título original', value: movie.originalTitle || null },
    { label: 'Lançamento', value: formatDate(movie.releaseDate) },
    { label: 'Idioma original', value: movie.originalLanguage ? languageName(movie.originalLanguage) : null },
    { label: 'Orçamento', value: movie.budget > 0 ? usd.format(movie.budget) : null },
    { label: 'Receita', value: movie.revenue > 0 ? usd.format(movie.revenue) : null },
  ];
  return facts.filter((f): f is { label: string; value: ReactNode } => f.value !== null);
}

/** Ficha técnica rows for a series. */
export function tvFacts(tv: TvDetails): Array<{ label: string; value: ReactNode }> {
  const facts: Array<{ label: string; value: ReactNode | null }> = [
    { label: 'Título original', value: tv.originalTitle || null },
    { label: 'Estreia', value: formatDate(tv.releaseDate) },
    { label: 'Status', value: statusLabel(tv.status) || null },
    { label: 'Idioma original', value: tv.originalLanguage ? languageName(tv.originalLanguage) : null },
  ];
  return facts.filter((f): f is { label: string; value: ReactNode } => f.value !== null);
}
