/* Captures real TMDb responses into src/test/fixtures. Run: npx tsx scripts/capture-fixtures.ts */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

process.loadEnvFile('.env.local');

const token = process.env.TMDB_READ_TOKEN;
const base = process.env.TMDB_API_BASE_URL || 'https://api.themoviedb.org/3';
if (!token) throw new Error('TMDB_READ_TOKEN ausente em .env.local');

const outDir = path.join('src', 'test', 'fixtures');

interface Capture {
  file: string;
  path: string;
  params?: Record<string, string>;
}

const captures: Capture[] = [
  { file: 'trending-all-day', path: 'trending/all/day' },
  { file: 'trending-movie-week', path: 'trending/movie/week' },
  { file: 'trending-tv-week', path: 'trending/tv/week' },
  { file: 'movie-now-playing-br', path: 'movie/now_playing', params: { region: 'BR' } },
  { file: 'movie-upcoming-br', path: 'movie/upcoming', params: { region: 'BR' } },
  {
    file: 'discover-movie-popular',
    path: 'discover/movie',
    params: { sort_by: 'popularity.desc', include_adult: 'false' },
  },
  {
    file: 'movie-550',
    path: 'movie/550',
    params: {
      append_to_response: 'videos,credits,release_dates,watch/providers,recommendations,external_ids',
      include_video_language: 'pt,en,null',
    },
  },
  { file: 'movie-550-en', path: 'movie/550', params: { language: 'en-US' } },
  {
    file: 'tv-1399',
    path: 'tv/1399',
    params: {
      append_to_response: 'videos,aggregate_credits,content_ratings,watch/providers,recommendations',
      include_video_language: 'pt,en,null',
    },
  },
  { file: 'tv-1399-season-1', path: 'tv/1399/season/1' },
  {
    file: 'person-287',
    path: 'person/287',
    params: { append_to_response: 'combined_credits,images' },
  },
  { file: 'search-multi-matrix', path: 'search/multi', params: { query: 'matrix', include_adult: 'false' } },
  { file: 'genre-movie-list', path: 'genre/movie/list' },
  { file: 'genre-tv-list', path: 'genre/tv/list' },
  { file: 'watch-providers-movie-br', path: 'watch/providers/movie', params: { watch_region: 'BR' } },
  // Extra fixtures for the E2E mock (e2e/mock-tmdb.ts): distinct title sets so home rails survive dedupe.
  { file: 'movie-popular-br', path: 'movie/popular', params: { region: 'BR' } },
  { file: 'discover-movie-page-2', path: 'discover/movie', params: { sort_by: 'popularity.desc', include_adult: 'false', page: '2' } },
  { file: 'discover-movie-page-3', path: 'discover/movie', params: { sort_by: 'popularity.desc', include_adult: 'false', page: '3' } },
  { file: 'discover-movie-page-4', path: 'discover/movie', params: { sort_by: 'popularity.desc', include_adult: 'false', page: '4' } },
  { file: 'discover-tv-popular', path: 'discover/tv', params: { sort_by: 'popularity.desc', include_adult: 'false' } },
  { file: 'discover-tv-page-2', path: 'discover/tv', params: { sort_by: 'popularity.desc', include_adult: 'false', page: '2' } },
  { file: 'tv-on-the-air', path: 'tv/on_the_air' },
  { file: 'tv-airing-today', path: 'tv/airing_today', params: { timezone: 'America/Sao_Paulo' } },
  { file: 'tv-popular', path: 'tv/popular' },
  { file: 'watch-providers-tv-br', path: 'watch/providers/tv', params: { watch_region: 'BR' } },
];

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });

  for (const c of captures) {
    const url = new URL(`${base}/${c.path}`);
    url.searchParams.set('language', 'pt-BR');
    for (const [k, v] of Object.entries(c.params ?? {})) url.searchParams.set(k, v);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`${c.path} -> HTTP ${res.status}`);
    const json: unknown = await res.json();
    await writeFile(path.join(outDir, `${c.file}.json`), `${JSON.stringify(json, null, 2)}\n`);
    console.log(`ok ${c.file}.json`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
