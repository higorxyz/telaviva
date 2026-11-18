import { describe, expect, it } from 'vitest';
import { filtersToSearchParams, parseFilters, toTmdbParams, type DiscoverFilters } from './filters';

const parse = (qs: string) => parseFilters(new URLSearchParams(qs));

describe('parseFilters', () => {
  it('sanitizes: bad genre dropped, rating clamped, years swapped, series ignores runtime', () => {
    const f = parse('tipo=serie&generos=18,abc&nota=11&de=2030&ate=2020&duracao=90');
    expect(f).toMatchObject({ media: 'tv', genres: [18], minRating: 10 });
    expect(f.yearFrom).toBe(2020);
    expect(f.yearTo).toBe(2030);
    expect(f.maxRuntime).toBeUndefined();
    expect(toTmdbParams(f)).not.toHaveProperty('with_runtime.lte');
  });

  it('defaults for an empty or unknown query', () => {
    expect(parse('')).toMatchObject({ media: 'movie', genres: [], providers: [], sort: 'popularidade' });
    expect(parse('tipo=x&ordem=y')).toMatchObject({ media: 'movie', sort: 'popularidade' });
  });

  it('snaps and clamps numeric filters', () => {
    expect(parse('nota=7.3&duracao=3')).toMatchObject({ minRating: 7.5, maxRuntime: 40 });
    expect(parse('duracao=999')).toMatchObject({ maxRuntime: 400 });
    expect(parse('duracao=92')).toMatchObject({ maxRuntime: 90 });
    expect(parse('nota=-3').minRating).toBeUndefined();
    expect(parse('votos=-1').minVotes).toBeUndefined();
    expect(parse('votos=1234')).toMatchObject({ minVotes: 1234 });
    expect(parse('votos=abc').minVotes).toBeUndefined();
  });

  it('validates language and providers', () => {
    expect(parse('idioma=KO')).toMatchObject({ language: 'ko' });
    expect(parse('idioma=portugues').language).toBeUndefined();
    expect(parse('provedores=8,x,119,8').providers).toEqual([8, 119]);
  });
});

describe('filtersToSearchParams', () => {
  it('omits defaults', () => {
    expect(filtersToSearchParams(parse('')).toString()).toBe('');
    expect(filtersToSearchParams(parse('tipo=filme&ordem=popularidade&nota=0')).toString()).toBe('');
  });

  it('uses a stable param order', () => {
    const f = parse('ordem=nota&provedores=8&idioma=ko&duracao=100&votos=5&nota=8&ate=2000&de=1990&generos=1,2&tipo=filme');
    expect(filtersToSearchParams(f).toString()).toBe(
      'generos=1%2C2&de=1990&ate=2000&nota=8&votos=5&duracao=100&idioma=ko&provedores=8&ordem=nota',
    );
  });

  it('round-trips', () => {
    const cases: DiscoverFilters[] = [
      { media: 'movie', genres: [28, 12], yearFrom: 1990, yearTo: 1999, minRating: 7.5, minVotes: 500, maxRuntime: 100, language: 'ko', providers: [8, 119], sort: 'bilheteria' },
      { media: 'tv', genres: [18], providers: [], sort: 'titulo', minRating: 6 },
      { media: 'movie', genres: [], providers: [], sort: 'popularidade' },
    ];
    for (const f of cases) expect(parseFilters(filtersToSearchParams(f))).toEqual(f);
  });
});

describe('toTmdbParams', () => {
  it('maps movie filters', () => {
    const p = toTmdbParams(
      parse('generos=28,12&de=1990&ate=1999&nota=7.5&votos=500&duracao=100&idioma=ko&provedores=8,119&ordem=lancamento'),
    );
    expect(p).toEqual({
      sort_by: 'primary_release_date.desc',
      with_genres: '28,12',
      'primary_release_date.gte': '1990-01-01',
      'primary_release_date.lte': '1999-12-31',
      'vote_average.gte': 7.5,
      'vote_count.gte': 500,
      'with_runtime.lte': 100,
      with_original_language: 'ko',
      with_watch_providers: '8|119',
      watch_region: 'BR',
      include_adult: false,
    });
  });

  it('maps series filters and sorts', () => {
    const p = toTmdbParams(parse('tipo=serie&de=2020&ate=2021&ordem=titulo'));
    expect(p).toMatchObject({
      sort_by: 'name.asc',
      'first_air_date.gte': '2020-01-01',
      'first_air_date.lte': '2021-12-31',
    });
    expect(p).not.toHaveProperty('primary_release_date.gte');
    expect(toTmdbParams(parse('tipo=serie&ordem=bilheteria'))).toMatchObject({ sort_by: 'popularity.desc' });
    expect(toTmdbParams(parse('tipo=serie&ordem=lancamento'))).toMatchObject({ sort_by: 'first_air_date.desc' });
  });

  it('applies a minimum of 200 votes only for rating sort without explicit votes', () => {
    expect(toTmdbParams(parse('ordem=nota'))).toMatchObject({ sort_by: 'vote_average.desc', 'vote_count.gte': 200 });
    expect(toTmdbParams(parse('ordem=nota&votos=1000'))).toMatchObject({ 'vote_count.gte': 1000 });
    expect(toTmdbParams(parse(''))).not.toHaveProperty('vote_count.gte');
  });
});

describe('series sort', () => {
  it('maps box office to popularity for series so state and select agree', () => {
    expect(parse('tipo=serie&ordem=bilheteria').sort).toBe('popularidade');
    expect(parse('ordem=bilheteria').sort).toBe('bilheteria');
  });
});
