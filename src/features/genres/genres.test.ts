import { describe, expect, it } from 'vitest';
import { mediaOfTipo, findGenre, pickBackdrop, pickDistinctBackdrops, discoverEndpoint } from './genres';

const genres = [
  { id: 28, name: 'Ação' },
  { id: 18, name: 'Drama' },
];

describe('mediaOfTipo', () => {
  it('maps the URL segment to a TMDb media type', () => {
    expect(mediaOfTipo('filme')).toBe('movie');
    expect(mediaOfTipo('serie')).toBe('tv');
    expect(mediaOfTipo('xyz')).toBeNull();
    expect(mediaOfTipo('movie')).toBeNull();
  });
});

describe('findGenre', () => {
  it('finds a genre by the id in its slug', () => {
    expect(findGenre(genres, '28-acao')).toEqual({ id: 28, name: 'Ação' });
    expect(findGenre(genres, '28')).toEqual({ id: 28, name: 'Ação' });
    expect(findGenre(genres, '28-qualquer-coisa')).toEqual({ id: 28, name: 'Ação' });
  });

  it('returns null for unknown ids and malformed slugs', () => {
    expect(findGenre(genres, '999999-x')).toBeNull();
    expect(findGenre(genres, 'acao')).toBeNull();
  });
});

describe('pickBackdrop', () => {
  it('picks the first result that has a backdrop', () => {
    expect(pickBackdrop([{ backdropPath: null }, { backdropPath: '/a.jpg' }, { backdropPath: '/b.jpg' }])).toBe('/a.jpg');
  });
  it('returns null when none has one', () => {
    expect(pickBackdrop([{ backdropPath: null }])).toBeNull();
    expect(pickBackdrop([])).toBeNull();
  });
});

describe('pickDistinctBackdrops', () => {
  const t = (id: number, backdropPath: string | null = `/${id}.jpg`) => ({ id, backdropPath });

  it('gives a later genre its next title when the top one already covers an earlier genre', () => {
    // Title 1 tops both Drama and Suspense: Drama keeps it, Suspense falls to its second title.
    expect(pickDistinctBackdrops([[t(1), t(2)], [t(1), t(3)]])).toEqual(['/1.jpg', '/3.jpg']);
  });
  it('skips titles without a backdrop and keeps failed genres empty', () => {
    expect(pickDistinctBackdrops([[t(1, null), t(2)], null, [t(2), t(4, null), t(5)]])).toEqual(['/2.jpg', null, '/5.jpg']);
  });
  it('repeats a cover only when every candidate is already taken', () => {
    expect(pickDistinctBackdrops([[t(1)], [t(1)]])).toEqual(['/1.jpg', '/1.jpg']);
  });
});

describe('discoverEndpoint', () => {
  it('points the grid at /api/discover with the genre id', () => {
    expect(discoverEndpoint('filme', 28)).toBe('/api/discover?tipo=filme&generos=28');
    expect(discoverEndpoint('serie', 10759)).toBe('/api/discover?tipo=serie&generos=10759');
  });
});
