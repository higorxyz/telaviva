import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import movie550 from '@/test/fixtures/movie-550.json';
import movie550En from '@/test/fixtures/movie-550-en.json';
import person287 from '@/test/fixtures/person-287.json';
import tv1399 from '@/test/fixtures/tv-1399.json';
import season1 from '@/test/fixtures/tv-1399-season-1.json';
import { server } from '@/test/server';
import { isTmdbNotFound } from './client';
import { getMovieDetails } from './movies';
import { getPerson } from './people';
import { getSeason, getTvDetails } from './tv';

const BASE = 'https://api.themoviedb.org/3';

function lastRequest(path: string, body: unknown) {
  const captured: { url?: URL } = {};
  server.use(
    http.get(`${BASE}/${path}`, ({ request }) => {
      captured.url = new URL(request.url);
      return HttpResponse.json(body as Record<string, unknown>);
    }),
  );
  return captured;
}

describe('getMovieDetails', () => {
  it('404 do TMDb vira TmdbError reconhecível por isTmdbNotFound', async () => {
    server.use(
      http.get(`${BASE}/movie/999999999`, () =>
        HttpResponse.json({ status_message: 'The resource you requested could not be found.' }, { status: 404 }),
      ),
    );
    const error = await getMovieDetails(999999999).catch((e: unknown) => e);
    expect(isTmdbNotFound(error)).toBe(true);
  });

  it('mapeia o filme com uma única requisição e append_to_response', async () => {
    const req = lastRequest('movie/550', movie550);
    const m = await getMovieDetails(550);
    expect(m).toMatchObject({ id: 550, mediaType: 'movie', runtime: 139, imdbId: 'tt0137523', budget: 63000000, revenue: 100853753 });
    expect(m.trailer?.site).toBe('YouTube');
    expect(m.certification).toBe('16');
    expect(m.cast.length).toBeGreaterThan(0);
    expect(m.cast.length).toBeLessThanOrEqual(20);
    const orders = m.cast.map((c) => c.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(m.genres.length).toBeGreaterThan(0);
    expect(m.providers.flatrate.length).toBeGreaterThan(0);
    expect(m.recommendations.length).toBeGreaterThan(0);
    expect(req.url!.searchParams.get('append_to_response')).toBe(
      'videos,credits,release_dates,watch/providers,recommendations,external_ids',
    );
    expect(req.url!.searchParams.get('include_video_language')).toBe('pt,en,null');
  });

  it('cai para a sinopse en-US quando a pt-BR está vazia', async () => {
    server.use(
      http.get(`${BASE}/movie/550`, ({ request }) => {
        const lang = new URL(request.url).searchParams.get('language');
        return HttpResponse.json(lang === 'en-US' ? movie550En : { ...movie550, overview: '' });
      }),
    );
    const m = await getMovieDetails(550);
    expect(m.overview).toBe(movie550En.overview);
  });

  it('providers vazios quando não há entrada BR', async () => {
    lastRequest('movie/550', { ...movie550, 'watch/providers': { results: {} } });
    const m = await getMovieDetails(550);
    expect(m.providers).toEqual({ link: null, flatrate: [], free: [], ads: [], rent: [], buy: [] });
  });
});

describe('getTvDetails / getSeason', () => {
  it('mapeia a série, mantendo a temporada 0', async () => {
    const req = lastRequest('tv/1399', tv1399);
    const t = await getTvDetails(1399);
    expect(t).toMatchObject({ id: 1399, mediaType: 'tv', certification: '16' });
    expect(t.seasons.find((s) => s.seasonNumber === 0)).toBeDefined();
    expect(t.trailer?.site).toBe('YouTube');
    expect(t.cast.length).toBeLessThanOrEqual(20);
    expect(t.cast[0]!.character).toBe("Tyrion 'The Halfman' Lannister");
    expect(t.lastEpisodeToAir).toMatchObject({ seasonNumber: 8, episodeNumber: 6 });
    expect(t.nextEpisodeToAir).toBeNull();
    expect(t.episodeRunTime).toBeNull();
    expect(req.url!.searchParams.get('append_to_response')).toBe(
      'videos,aggregate_credits,content_ratings,watch/providers,recommendations',
    );
    expect(req.url!.searchParams.get('include_video_language')).toBe('pt,en,null');
  });

  it('mapeia os episódios da temporada', async () => {
    lastRequest('tv/1399/season/1', season1);
    const s = await getSeason(1399, 1);
    expect(s.seasonNumber).toBe(1);
    expect(s.episodes[0]).toMatchObject({ seasonNumber: 1, episodeNumber: 1 });
  });
});

describe('404 de série e temporada', () => {
  // next/cache is mocked here, so this cannot prove the 'use cache' boundary fix;
  // the real 404 through the cache was verified in production with curl.
  it('getTvDetails e getSeason rejeitam com TmdbError 404 reconhecível', async () => {
    server.use(
      http.get(`${BASE}/tv/999999999`, () => HttpResponse.json({ status_message: 'nope' }, { status: 404 })),
      http.get(`${BASE}/tv/1399/season/99`, () => HttpResponse.json({ status_message: 'nope' }, { status: 404 })),
    );
    expect(isTmdbNotFound(await getTvDetails(999999999).catch((e: unknown) => e))).toBe(true);
    expect(isTmdbNotFound(await getSeason(1399, 99).catch((e: unknown) => e))).toBe(true);
  });
});

describe('getPerson', () => {
  it('mapeia a pessoa com créditos e fotos', async () => {
    lastRequest('person/287', person287);
    const p = await getPerson(287);
    expect(p).toMatchObject({ id: 287, name: 'Brad Pitt' });
    expect(p.credits.length).toBeGreaterThan(0);
    expect(p.credits[0]).toHaveProperty('role');
    expect(p.credits[0]).toHaveProperty('department');
    const pops = p.credits.map((c) => c.popularity);
    expect(pops).toEqual([...pops].sort((a, b) => b - a));
    expect(p.images.length).toBeGreaterThan(0);
  });

  it('404 do TMDb vira TmdbError reconhecível', async () => {
    server.use(
      http.get(`${BASE}/person/999999999`, () => HttpResponse.json({ status_message: 'nope' }, { status: 404 })),
    );
    expect(isTmdbNotFound(await getPerson(999999999).catch((e: unknown) => e))).toBe(true);
  });

  it('mantém a biografia pt-BR sem requisição extra', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/person/287`, () => {
        calls += 1;
        return HttpResponse.json(person287);
      }),
    );
    const p = await getPerson(287);
    expect(p.biography).toBe(person287.biography);
    expect(calls).toBe(1);
  });

  it('sem biografia em pt-BR usa a de en-US', async () => {
    const langs: Array<string | null> = [];
    server.use(
      http.get(`${BASE}/person/287`, ({ request }) => {
        const language = new URL(request.url).searchParams.get('language');
        langs.push(language);
        return HttpResponse.json(
          language === 'en-US' ? { ...person287, biography: 'English bio' } : { ...person287, biography: '' },
        );
      }),
    );
    const p = await getPerson(287);
    expect(p.biography).toBe('English bio');
    expect(langs).toEqual(['pt-BR', 'en-US']);
  });
});

describe('conteúdo adulto', () => {
  it('detalhe de filme ou série adulto vira 404 e recomendações adultas somem', async () => {
    server.use(
      http.get(`${BASE}/movie/77`, () => HttpResponse.json({ ...movie550, id: 77, adult: true })),
      http.get(`${BASE}/tv/78`, () => HttpResponse.json({ ...tv1399, id: 78, adult: true })),
    );
    expect(isTmdbNotFound(await getMovieDetails(77).catch((e: unknown) => e))).toBe(true);
    expect(isTmdbNotFound(await getTvDetails(78).catch((e: unknown) => e))).toBe(true);

    const recs = movie550.recommendations.results;
    lastRequest('movie/550', {
      ...movie550,
      recommendations: { ...movie550.recommendations, results: [{ ...recs[0], id: 4242, adult: true }, ...recs] },
    });
    const m = await getMovieDetails(550);
    expect(m.recommendations.some((r) => r.id === 4242)).toBe(false);
  });

  it('créditos adultos da pessoa somem', async () => {
    const cast = person287.combined_credits.cast;
    lastRequest('person/287', {
      ...person287,
      combined_credits: { ...person287.combined_credits, cast: [{ ...cast[0], id: 4343, adult: true }, ...cast] },
    });
    const p = await getPerson(287);
    expect(p.credits.some((c) => c.id === 4343)).toBe(false);
  });
});
