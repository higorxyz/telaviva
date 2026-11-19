import { describe, expect, it } from 'vitest';
import { libraryStats, parseLibraryQuery, selectItems, toLibrarySearch } from './library-query';
import { entry, mark, rating, stateOf } from './test-state';

const p = (qs: string) => new URLSearchParams(qs);

describe('parseLibraryQuery', () => {
  it('defaults to Assistindo when a series is in progress, else Quero ver', () => {
    expect(parseLibraryQuery(p(''), true)).toEqual({ aba: 'assistindo', tipo: null, ordem: 'recentes' });
    expect(parseLibraryQuery(p(''), false)).toEqual({ aba: 'quero-ver', tipo: null, ordem: 'recentes' });
  });

  it('reads valid values', () => {
    expect(parseLibraryQuery(p('aba=assistidos&tipo=serie&ordem=nota'), false)).toEqual({
      aba: 'assistidos', tipo: 'tv', ordem: 'nota',
    });
    expect(parseLibraryQuery(p('tipo=filme&ordem=ano'), true)).toMatchObject({ tipo: 'movie', ordem: 'ano' });
  });

  it('falls back to the defaults for invalid values', () => {
    expect(parseLibraryQuery(p('aba=x&tipo=y&ordem=z'), true)).toEqual({
      aba: 'assistindo', tipo: null, ordem: 'recentes',
    });
  });
});

describe('toLibrarySearch', () => {
  it('omits the defaults', () => {
    expect(toLibrarySearch({ aba: 'quero-ver', tipo: null, ordem: 'recentes' })).toBe('');
    expect(toLibrarySearch({ aba: 'assistindo', tipo: null, ordem: 'recentes' }, true)).toBe('');
  });

  it('serializes what differs from the defaults', () => {
    expect(toLibrarySearch({ aba: 'assistidos', tipo: 'tv', ordem: 'titulo' })).toBe(
      'aba=assistidos&tipo=serie&ordem=titulo',
    );
    expect(toLibrarySearch({ aba: 'quero-ver', tipo: 'movie', ordem: 'recentes' }, true)).toBe(
      'aba=quero-ver&tipo=filme',
    );
  });
});

describe('selectItems', () => {
  const state = stateOf({
    items: [
      entry('movie', 1, 'want', { title: 'Zebra', releaseDate: '2010-01-01', updatedAt: '2026-11-02T00:00:00.000Z' }),
      entry('movie', 2, 'want', { title: 'Água', releaseDate: null, updatedAt: '2026-11-04T00:00:00.000Z' }),
      entry('tv', 3, 'want', { title: 'Mundo', releaseDate: '2022-01-01', updatedAt: '2026-11-03T00:00:00.000Z' }),
      entry('tv', 4, 'watching', { title: 'Em curso' }),
      entry('movie', 5, 'watched', { title: 'Visto' }),
    ],
    ratings: [rating('movie', 1, 9), rating('tv', 3, 4)],
  });
  const q = (o: object) => ({ aba: 'quero-ver' as const, tipo: null, ordem: 'recentes' as const, ...o });
  const ids = (items: { tmdbId: number }[]) => items.map((i) => i.tmdbId);

  it('picks the tab by status', () => {
    expect(ids(selectItems(state, q({ aba: 'assistindo' })))).toEqual([4]);
    expect(ids(selectItems(state, q({ aba: 'assistidos' })))).toEqual([5]);
    expect(selectItems(state, q({}))).toHaveLength(3);
  });

  it('filters by type, except in Assistindo', () => {
    expect(ids(selectItems(state, q({ tipo: 'tv' })))).toEqual([3]);
    expect(ids(selectItems(state, q({ aba: 'assistindo', tipo: 'movie' })))).toEqual([4]);
  });

  it('sorts recent first', () => {
    expect(ids(selectItems(state, q({})))).toEqual([2, 3, 1]);
  });

  it('sorts by title in pt-BR', () => {
    expect(ids(selectItems(state, q({ ordem: 'titulo' })))).toEqual([2, 3, 1]);
  });

  it('sorts by score, unrated last', () => {
    expect(ids(selectItems(state, q({ ordem: 'nota' })))).toEqual([1, 3, 2]);
  });

  it('sorts by year, undated last', () => {
    expect(ids(selectItems(state, q({ ordem: 'ano' })))).toEqual([3, 1, 2]);
  });
});

describe('libraryStats', () => {
  it('counts by status and ignores season 0', () => {
    const stats = libraryStats(
      stateOf({
        items: [
          entry('movie', 1, 'watched'), entry('movie', 2, 'watched'), entry('tv', 3, 'watched'),
          entry('tv', 4, 'watching'), entry('movie', 5, 'want'), entry('tv', 6, 'want'),
        ],
        episodes: [mark(4, 1, 1), mark(4, 1, 2), mark(4, 0, 1)],
        ratings: [rating('movie', 1, 8), rating('movie', 2, 7)],
      }),
    );
    expect(stats).toEqual({
      moviesWatched: 2, seriesWatched: 1, seriesWatching: 1, episodesWatched: 2, wantCount: 2, averageScore: 7.5,
    });
  });

  it('has no average without ratings', () => {
    expect(libraryStats(stateOf({})).averageScore).toBeNull();
  });
});
