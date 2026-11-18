import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import movie550 from '@/test/fixtures/movie-550.json';
import movie550En from '@/test/fixtures/movie-550-en.json';
import person287 from '@/test/fixtures/person-287.json';
import tv1399 from '@/test/fixtures/tv-1399.json';
import season1 from '@/test/fixtures/tv-1399-season-1.json';
import { server } from '@/test/server';
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
  it('mapeia o filme com uma única requisição e append_to_response', async () => {
    const req = lastRequest('movie/550', movie550);
    const m = await getMovieDetails(550);
    expect(m).toMatchObject({ id: 550, mediaType: 'movie', runtime: 139, imdbId: 'tt0137523' });
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
});
