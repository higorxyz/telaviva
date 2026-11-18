import { describe, expect, it } from 'vitest';
import { activeChips, clearFilters, switchMedia } from './chips';
import { parseFilters } from './filters';
import type { DiscoverCatalog } from './labels';

const catalog: DiscoverCatalog = {
  genres: {
    movie: [{ id: 28, name: 'Ação' }, { id: 18, name: 'Drama' }],
    tv: [{ id: 18, name: 'Drama' }, { id: 10759, name: 'Ação e Aventura' }],
  },
  providers: {
    movie: [{ id: 8, name: 'Netflix', logoPath: null }],
    tv: [{ id: 8, name: 'Netflix', logoPath: null }, { id: 337, name: 'Disney Plus', logoPath: null }],
  },
};
const parse = (qs: string) => parseFilters(new URLSearchParams(qs));

describe('activeChips', () => {
  it('has no chips for the defaults', () => {
    expect(activeChips(parse('tipo=serie&ordem=nota'), catalog)).toEqual([]);
  });

  it('describes each active filter and removes only it', () => {
    const f = parse('generos=28,18&de=1990&ate=1999&nota=7.5&votos=1000&duracao=100&idioma=ko&provedores=8');
    const chips = activeChips(f, catalog);
    expect(chips.map((c) => c.label)).toEqual([
      'Gênero: Ação',
      'Gênero: Drama',
      'A partir de 1990',
      'Até 1999',
      'Nota 7,5+',
      '1.000+ votos',
      'Até 100 min',
      'Idioma: Coreano',
      'Provedor: Netflix',
    ]);
    expect(chips[0].next.genres).toEqual([18]);
    expect(chips[4].next.minRating).toBeUndefined();
    expect(chips[4].next.minVotes).toBe(1000);
  });
});

describe('clearFilters / switchMedia', () => {
  it('clears filters but keeps type and sort', () => {
    expect(clearFilters(parse('tipo=serie&generos=18&nota=8&ordem=nota'))).toEqual({
      media: 'tv', genres: [], providers: [], sort: 'nota',
    });
  });

  it('drops genres, providers and runtime that do not exist for the new type', () => {
    const next = switchMedia(parse('generos=28,18&provedores=8&duracao=100&ordem=bilheteria'), 'tv', catalog);
    expect(next).toMatchObject({ media: 'tv', genres: [18], providers: [8], sort: 'popularidade' });
    expect(next.maxRuntime).toBeUndefined();
  });
});
