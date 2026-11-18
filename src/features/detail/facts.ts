import type { ReactNode } from 'react';
import type { MovieDetails, PersonDetails, TvDetails } from '@/features/tmdb/types';
import { formatDate } from '@/lib/format';
import { departmentLabel } from './person';
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

/** Ficha da pessoa; ages are computed by the caller. */
export function personFacts(
  person: PersonDetails,
  ages: { now: number | null; atDeath: number | null },
): Array<{ label: string; value: ReactNode }> {
  const born = formatDate(person.birthday);
  const died = formatDate(person.deathday);
  const facts: Array<{ label: string; value: ReactNode | null }> = [
    { label: 'Nascimento', value: born && (person.deathday || ages.now === null ? born : `${born} (${ages.now} anos)`) },
    { label: 'Falecimento', value: died && (ages.atDeath === null ? died : `${died} (${ages.atDeath} anos)`) },
    { label: 'Local de nascimento', value: person.placeOfBirth },
    { label: 'Área', value: person.knownForDepartment ? departmentLabel(person.knownForDepartment) : null },
    { label: 'Também conhecido como', value: person.alsoKnownAs.length ? person.alsoKnownAs.slice(0, 3).join(', ') : null },
  ];
  return facts.filter((f): f is { label: string; value: ReactNode } => f.value !== null && f.value !== '');
}
