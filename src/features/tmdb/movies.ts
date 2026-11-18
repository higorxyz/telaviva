import { cacheLife, cacheTag } from 'next/cache';
import { z } from 'zod';
import { refine, sortByWeightedRating } from '@/features/catalog/curation';
import { tmdbFetch, type TmdbParams } from './client';
import { toMovieDetails } from './detail-mappers';
import { movieDetailSchema, overviewOnlySchema } from './detail-schemas';
import { fetchDiscover } from './discover';
import { toMediaSummary, toPaginated, withOverviewFallback } from './mappers';
import { parseMediaItem } from './media-item';
import { moviePageSchema, pageSchema } from './schemas';
import type { MediaSummary, MediaType, MovieDetails, Paginated } from './types';

export type MovieListKey =
  | 'now_playing'
  | 'upcoming'
  | 'popular'
  | 'top_rated'
  | 'hidden_gems'
  | 'short'
  | 'blockbusters'
  | 'streaming_br';

const DAY_MS = 86_400_000;

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/** Discover params per list; rules ported from v1. */
function listParams(list: Exclude<MovieListKey, 'popular'>): TmdbParams {
  switch (list) {
    case 'now_playing':
      return {
        region: 'BR',
        with_release_type: '2|3',
        'release_date.gte': isoDate(-120),
        'release_date.lte': isoDate(14),
        'vote_count.gte': 40,
        sort_by: 'popularity.desc',
      };
    case 'upcoming':
      return {
        region: 'BR',
        with_release_type: '2|3',
        'release_date.gte': isoDate(1),
        'release_date.lte': isoDate(450),
        sort_by: 'popularity.desc',
      };
    case 'top_rated':
      return { 'vote_count.gte': 1200, 'vote_average.gte': 7.2, sort_by: 'vote_average.desc' };
    case 'hidden_gems':
      return {
        'vote_average.gte': 7.2,
        'vote_count.gte': 120,
        'vote_count.lte': 1200,
        sort_by: 'vote_average.desc',
      };
    case 'short':
      return {
        'with_runtime.lte': 100,
        'vote_count.gte': 100,
        'vote_average.gte': 6,
        sort_by: 'popularity.desc',
      };
    case 'blockbusters':
      return { sort_by: 'revenue.desc', 'vote_count.gte': 1000 };
    case 'streaming_br':
      return {
        watch_region: 'BR',
        with_watch_monetization_types: 'flatrate',
        sort_by: 'popularity.desc',
      };
  }
}

export async function getMovieList(list: MovieListKey, page = 1): Promise<Paginated<MediaSummary>> {
  'use cache';
  cacheLife('tmdbHot');
  cacheTag('tmdb', `movie-list:${list}`);
  const result =
    list === 'popular'
      ? toPaginated(await tmdbFetch('movie/popular', { region: 'BR', page }, moviePageSchema), (r) =>
          toMediaSummary(r, 'movie'),
        )
      : await fetchDiscover('movie', listParams(list), page);
  if (list === 'top_rated') return { ...result, results: sortByWeightedRating(result.results) };
  // Unreleased titles often lack a synopsis, so upcoming only requires an image.
  const rules = list === 'upcoming' ? { requireImage: true } : { requireImage: true, minOverviewLength: 20 };
  return { ...result, results: refine(result.results, rules) };
}

const mixedPageSchema = pageSchema(z.unknown());

export async function getTrending(
  media: MediaType | 'all',
  window: 'day' | 'week',
  page = 1,
): Promise<Paginated<MediaSummary>> {
  'use cache';
  cacheLife('tmdbHot');
  cacheTag('tmdb', `trending:${media}`);
  // trending does not accept include_adult.
  const raw = await tmdbFetch(`trending/${media}/${window}`, { page }, mixedPageSchema);
  const results = raw.results
    .map((item) =>
      media === 'all' ? parseMediaItem(item) : parseMediaItem({ ...(item as object), media_type: media }),
    )
    .filter((i): i is MediaSummary => i !== null);
  return { page: raw.page, totalPages: raw.total_pages, totalResults: raw.total_results, results };
}

const MOVIE_APPEND = 'videos,credits,release_dates,watch/providers,recommendations,external_ids';

export async function getMovieDetails(id: number): Promise<MovieDetails> {
  'use cache';
  cacheLife('tmdbDetail');
  cacheTag('tmdb', `movie:${id}`);
  const raw = await tmdbFetch(
    `movie/${id}`,
    { append_to_response: MOVIE_APPEND, include_video_language: 'pt,en,null' },
    movieDetailSchema,
  );
  return withOverviewFallback(toMovieDetails(raw), () =>
    tmdbFetch(`movie/${id}`, { language: 'en-US' }, overviewOnlySchema),
  );
}
