import { describe, expect, it } from 'vitest';
import movie550 from '@/test/fixtures/movie-550.json';
import tv1399 from '@/test/fixtures/tv-1399.json';
import { contentRatingsSchema, releaseDatesSchema } from '@/features/tmdb/detail-schemas';
import type { MediaSummary, Video } from '@/features/tmdb/types';
import {
  brCertification,
  brTvRating,
  pickTrailer,
  refine,
  sortByWeightedRating,
  weightedRating,
} from './curation';

function item(id: number, over: Partial<MediaSummary> = {}): MediaSummary {
  return {
    id,
    mediaType: 'movie',
    title: `Filme ${id}`,
    originalTitle: `Movie ${id}`,
    overview: 'Uma sinopse com tamanho suficiente para passar nos filtros.',
    posterPath: '/p.jpg',
    backdropPath: '/b.jpg',
    voteAverage: 7,
    voteCount: 500,
    popularity: 10,
    releaseDate: '2024-05-01',
    genreIds: [],
    originalLanguage: 'en',
    ...over,
  };
}

function video(over: Partial<Video>): Video {
  return { key: 'k', site: 'YouTube', type: 'Trailer', official: false, language: 'en', name: 'v', ...over };
}

describe('weightedRating / sortByWeightedRating', () => {
  it('sem votos devolve a média global; com muitos votos converge para a nota', () => {
    expect(weightedRating(9, 0)).toBeCloseTo(6.8);
    expect(weightedRating(9, 100000)).toBeGreaterThan(8.9);
  });

  it('nota alta com poucos votos não vence', () => {
    const a = item(1, { voteAverage: 9.5, voteCount: 20 });
    const b = item(2, { voteAverage: 8.4, voteCount: 30000 });
    expect(sortByWeightedRating([a, b])[0]!.id).toBe(b.id);
  });

  it('não altera o array original', () => {
    const list = [item(1, { voteAverage: 5 }), item(2, { voteAverage: 9, voteCount: 9000 })];
    sortByWeightedRating(list);
    expect(list[0]!.id).toBe(1);
  });
});

describe('refine', () => {
  const items10 = Array.from({ length: 10 }, (_, i) => item(i + 1));

  it('filtra por nota, votos, imagem, sinopse e datas', () => {
    const items = [
      ...items10,
      item(20, { voteAverage: 3 }),
      item(21, { voteCount: 1 }),
      item(22, { posterPath: null }),
      item(23, { overview: 'curta' }),
      item(24, { releaseDate: '2001-01-01' }),
      item(25, { releaseDate: null }),
    ];
    const out = refine(items, {
      minVoteAverage: 5,
      minVoteCount: 100,
      requireImage: true,
      minOverviewLength: 20,
      minDate: new Date('2010-01-01'),
      maxDate: new Date('2030-01-01'),
    });
    expect(out.map((i) => i.id)).toEqual(items10.map((i) => i.id));
  });

  it('devolve os itens originais se sobrarem menos que o mínimo (fallback)', () => {
    expect(refine(items10, { minVoteCount: 1e9, minResultsBeforeFallback: 8 })).toHaveLength(10);
  });

  it('usa 8 como mínimo padrão', () => {
    const few = [item(1), item(2, { voteCount: 1 })];
    expect(refine(few, { minVoteCount: 100 })).toHaveLength(2);
    expect(refine(items10, { minVoteCount: 1000, minResultsBeforeFallback: 0 })).toHaveLength(0);
  });
});

describe('pickTrailer', () => {
  it('prefere YouTube, Trailer, oficial e pt, e ignora outros sites', () => {
    const picked = pickTrailer([
      video({ key: 'vimeo', site: 'Vimeo', type: 'Trailer', official: true, language: 'pt' }),
      video({ key: 'teaser', type: 'Teaser', official: false, language: 'en' }),
      video({ key: 'trailer-oficial', type: 'Trailer', official: true, language: 'en' }),
    ]);
    expect(picked?.key).toBe('trailer-oficial');
  });

  it('pt desempata a favor do idioma', () => {
    const picked = pickTrailer([
      video({ key: 'en', language: 'en' }),
      video({ key: 'pt', language: 'pt' }),
    ]);
    expect(picked?.key).toBe('pt');
  });

  it('devolve null sem vídeos ou sem YouTube', () => {
    expect(pickTrailer([])).toBeNull();
    expect(pickTrailer([video({ site: 'Vimeo' })])).toBeNull();
  });
});

describe('classificação indicativa do Brasil', () => {
  it('lê a certificação BR do release_dates real do filme', () => {
    // O brief previa "18"; a fixture capturada do TMDb traz "16" para Clube da Luta no Brasil.
    expect(brCertification(releaseDatesSchema.parse(movie550.release_dates))).toBe('16');
  });

  it('prefere o lançamento em cinemas e ignora certificações vazias', () => {
    expect(
      brCertification({
        results: [
          { iso_3166_1: 'US', release_dates: [{ certification: 'R', type: 3 }] },
          {
            iso_3166_1: 'BR',
            release_dates: [
              { certification: '', type: 3 },
              { certification: '14', type: 4 },
              { certification: '12', type: 3 },
            ],
          },
        ],
      }),
    ).toBe('12');
  });

  it('devolve null sem entrada BR', () => {
    expect(brCertification({ results: [] })).toBeNull();
    expect(brTvRating({ results: [{ iso_3166_1: 'US', rating: 'TV-MA' }] })).toBeNull();
  });

  it('lê a classificação BR da série', () => {
    expect(brTvRating(contentRatingsSchema.parse(tv1399.content_ratings))).toBe('16');
  });
});
