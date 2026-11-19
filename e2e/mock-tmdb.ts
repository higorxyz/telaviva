/* Local TMDb stand-in for E2E. Run: npx tsx e2e/mock-tmdb.ts (port 4010). Serves src/test/fixtures. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const PORT = 4010;
const dir = path.join(process.cwd(), 'src', 'test', 'fixtures');

const cache = new Map<string, Record<string, unknown>>();
function fixture(name: string): Record<string, unknown> {
  let data = cache.get(name);
  if (!data) {
    data = JSON.parse(readFileSync(path.join(dir, `${name}.json`), 'utf8')) as Record<string, unknown>;
    cache.set(name, data);
  }
  return data;
}

/** Small stable hash, so the same list params always pick the same fixture. */
function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// Distinct title sets, so home rails still have >= 6 titles left after cross-rail dedupe.
const DISCOVER_MOVIE = [
  'discover-movie-popular',
  'discover-movie-page-2',
  'discover-movie-page-3',
  'discover-movie-page-4',
  'movie-now-playing-br',
  'movie-upcoming-br',
];
const DISCOVER_TV = ['discover-tv-popular', 'discover-tv-page-2'];

function pick(names: string[], params: URLSearchParams): string {
  const copy = new URLSearchParams(params);
  copy.delete('page');
  copy.delete('with_genres');
  copy.sort();
  return names[hash(copy.toString()) % names.length]!;
}

type Resolved = { status: number; body: unknown };
const notFound: Resolved = { status: 404, body: { status_message: 'not found' } };
const ok = (name: string): Resolved => ({ status: 200, body: fixture(name) });
const withId = (name: string, id: number): Resolved => ({ status: 200, body: { ...fixture(name), id } });

export function resolve(pathname: string, params: URLSearchParams): Resolved {
  const p = pathname.replace(/^\/3\//, '').replace(/\/$/, '');
  if (pathname === p) return notFound;

  const movie = /^movie\/(\d+)$/.exec(p);
  if (movie) {
    const id = Number(movie[1]);
    if (id === 999999999) return notFound;
    return withId(params.get('language') === 'en-US' ? 'movie-550-en' : 'movie-550', id);
  }
  const season = /^tv\/(\d+)\/season\/(\d+)$/.exec(p);
  if (season) {
    if (Number(season[1]) === 999999999) return notFound;
    return { status: 200, body: { ...fixture('tv-1399-season-1'), season_number: Number(season[2]) } };
  }
  const tv = /^tv\/(\d+)$/.exec(p);
  if (tv) return Number(tv[1]) === 999999999 ? notFound : withId('tv-1399', Number(tv[1]));
  const person = /^person\/(\d+)$/.exec(p);
  if (person) return Number(person[1]) === 999999999 ? notFound : withId('person-287', Number(person[1]));

  switch (p) {
    case 'trending/all/day':
      return ok('trending-all-day');
    case 'trending/movie/week':
    case 'trending/movie/day':
      return ok('trending-movie-week');
    case 'trending/tv/week':
    case 'trending/tv/day':
      return ok('trending-tv-week');
    case 'movie/popular':
      return ok('movie-popular-br');
    case 'movie/now_playing':
      return ok('movie-now-playing-br');
    case 'movie/upcoming':
      return ok('movie-upcoming-br');
    case 'tv/on_the_air':
      return ok('tv-on-the-air');
    case 'tv/airing_today':
      return ok('tv-airing-today');
    case 'tv/popular':
      return ok('tv-popular');
    case 'discover/movie':
      return ok(pick(DISCOVER_MOVIE, params));
    case 'discover/tv':
      return ok(pick(DISCOVER_TV, params));
    case 'search/multi':
      return ok('search-multi-matrix');
    case 'genre/movie/list':
      return ok('genre-movie-list');
    case 'genre/tv/list':
      return ok('genre-tv-list');
    case 'watch/providers/movie':
      return ok('watch-providers-movie-br');
    case 'watch/providers/tv':
      return ok('watch-providers-tv-br');
    default:
      return notFound;
  }
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const resolved = req.method === 'GET' ? resolve(url.pathname, url.searchParams) : notFound;
  const { status } = resolved;
  let body = resolved.body;
  // Paginated bodies echo the requested page, like TMDb does; clients paginate from `page`.
  if (status === 200 && body && typeof body === 'object' && 'results' in body && 'page' in body) {
    body = { ...body, page: Math.max(1, Number(url.searchParams.get('page')) || 1) };
  }
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}).listen(PORT, '127.0.0.1', () => console.log(`mock TMDb on http://127.0.0.1:${PORT}`));
