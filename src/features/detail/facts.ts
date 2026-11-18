import type { ReactNode } from 'react';
import type { MovieDetails } from '@/features/tmdb/types';
import { formatDate } from '@/lib/format';

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
