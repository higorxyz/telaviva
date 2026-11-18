import { cacheLife, cacheTag } from 'next/cache';
import { pickHero, mediaKey } from '@/features/catalog/hero-pick';
import type { HeroItem } from '@/features/catalog/Hero';
import { getMovieDetails, getMovieList, getTrending } from '@/features/tmdb/movies';
import { getTvDetails } from '@/features/tmdb/tv';
import type { MediaSummary } from '@/features/tmdb/types';

async function sources() {
  const [trending, popular, topRated] = await Promise.allSettled([
    getTrending('all', 'day'),
    getMovieList('popular'),
    getMovieList('top_rated'),
  ]);
  const items = (r: PromiseSettledResult<{ results: MediaSummary[] }>) =>
    r.status === 'fulfilled' ? r.value.results : [];
  return [
    { items: items(trending), sourceBoost: 22 },
    { items: items(popular), sourceBoost: 15 },
    { items: items(topRated), sourceBoost: 10 },
  ];
}

/** The featured title with its details; falls back to the summary if details fail. */
export async function getFeatured(): Promise<{ item: HeroItem; key: string } | null> {
  'use cache';
  cacheLife('tmdbHot');
  cacheTag('tmdb', 'home-featured');
  const picked = pickHero(await sources());
  if (!picked) return null;
  const key = mediaKey(picked);
  try {
    if (picked.mediaType === 'movie') {
      const d = await getMovieDetails(picked.id);
      return { key, item: { ...picked, runtime: d.runtime, genres: d.genres, trailer: d.trailer } };
    }
    const d = await getTvDetails(picked.id);
    return { key, item: { ...picked, runtime: d.episodeRunTime, genres: d.genres, trailer: d.trailer } };
  } catch (error) {
    console.error('[home] featured details failed:', error);
    return { key, item: picked };
  }
}

/** Current year on the Sao Paulo calendar, computed inside a cache scope. */
export async function getCurrentYear(): Promise<number> {
  'use cache';
  cacheLife('tmdbStatic');
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(Date.now()),
  );
}
