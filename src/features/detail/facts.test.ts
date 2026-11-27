import { describe, expect, it } from 'vitest';
import type { MovieDetails, TvDetails } from '@/features/tmdb/types';
import { movieFacts, tvFacts } from './facts';

describe('movieFacts', () => {
  const base = {
    originalTitle: 'Fight Club',
    releaseDate: '1999-10-15',
    originalLanguage: 'en',
    budget: 63000000,
    revenue: 0,
  } as MovieDetails;

  it('formata idioma e orçamento e omite receita zerada', () => {
    const facts = movieFacts(base);
    expect(facts.map((f) => f.label)).toEqual(['Título original', 'Lançamento', 'Idioma original', 'Orçamento']);
    expect(facts.find((f) => f.label === 'Idioma original')?.value).toBe('inglês');
    expect(String(facts.find((f) => f.label === 'Orçamento')?.value)).toMatch(/US\$\s?63\.000\.000/);
  });
});

describe('tvFacts', () => {
  it('traduz o status e omite campos vazios', () => {
    const facts = tvFacts({
      originalTitle: 'Game of Thrones',
      releaseDate: null,
      status: 'Ended',
      originalLanguage: 'en',
    } as TvDetails);
    expect(facts.map((f) => f.label)).toEqual(['Título original', 'Status', 'Idioma original']);
    expect(facts.find((f) => f.label === 'Status')?.value).toBe('Finalizada');
  });
});
