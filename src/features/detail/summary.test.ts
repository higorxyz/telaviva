import { describe, expect, it } from 'vitest';
import { truncateSummary } from './summary';
import { movieFacts } from './facts';
import type { MovieDetails } from '@/features/tmdb/types';

describe('truncateSummary', () => {
  it('mantém textos curtos', () => {
    expect(truncateSummary('  Uma  frase curta. ')).toBe('Uma frase curta.');
  });

  it('corta em limite de palavra com reticências, até 155 caracteres', () => {
    const out = truncateSummary('palavra '.repeat(40));
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith('palavra…')).toBe(true);
  });
});

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
