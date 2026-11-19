import { cacheLife, cacheTag } from 'next/cache';
import { z } from 'zod';
import { refine, sortByWeightedRating } from '@/features/catalog/curation';
import { availablePage, brAvailabilityParams, screenedCacheLife, withAvailableRecommendations } from './availability';
import { isTmdbNotFound, TmdbError, tmdbFetch, type TmdbParams } from './client';
import { saoPauloIsoDate } from './dates';
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

/**
 * Discover params per list; rules ported from v1. Feed lists ask TMDb for titles available in Brazil; the release
 * lists ("Nos cinemas", "Em breve") do not, and streaming_br keeps its subscription-only rule.
 */
function listParams(list: Exclude<MovieListKey, 'popular'>): TmdbParams {
  switch (list) {
    case 'now_playing':
      return {
        region: 'BR',
        with_release_type: '2|3',
        'release_date.gte': saoPauloIsoDate(-120),
        'release_date.lte': saoPauloIsoDate(14),
        'vote_count.gte': 40,
        sort_by: 'popularity.desc',
      };
    case 'upcoming':
      return {
        region: 'BR',
        with_release_type: '2|3',
        'release_date.gte': saoPauloIsoDate(1),
        'release_date.lte': saoPauloIsoDate(450),
        sort_by: 'popularity.desc',
      };
    case 'top_rated':
      return { 'vote_count.gte': 1200, 'vote_average.gte': 7.2, sort_by: 'vote_average.desc', ...brAvailabilityParams() };
    case 'hidden_gems':
      return {
        ...brAvailabilityParams(),
        'vote_average.gte': 7.2,
        'vote_count.gte': 120,
        'vote_count.lte': 1200,
        sort_by: 'vote_average.desc',
      };
    case 'short':
      return {
        ...brAvailabilityParams(),
        'with_runtime.lte': 100,
        'vote_count.gte': 100,
        'vote_average.gte': 6,
        sort_by: 'popularity.desc',
      };
    case 'blockbusters':
      return { sort_by: 'revenue.desc', 'vote_count.gte': 1000, ...brAvailabilityParams() };
    case 'streaming_br':
      return {
        watch_region: 'BR',
        with_watch_monetization_types: 'flatrate',
        sort_by: 'popularity.desc',
      };
  }
}

export async function getMovieList(list: MovieListKey, page: number): Promise<Paginated<MediaSummary>> {
  'use cache';
  cacheTag('tmdb', `movie-list:${list}`);
  if (list === 'popular') {
    const raw = await tmdbFetch('movie/popular', { region: 'BR', page }, moviePageSchema);
    const result = toPaginated(raw, (r) => toMediaSummary(r, 'movie'));
    // movie/popular has no watch filter, so its page is post-filtered (after refine: fewer titles to ask about).
    const screened = await availablePage({
      ...result,
      results: refine(result.results, { requireImage: true, minOverviewLength: 20 }),
    });
    screenedCacheLife(screened.unknown, 'tmdbHot');
    return screened.page;
  }
  cacheLife('tmdbHot');
  const result = await fetchDiscover('movie', listParams(list), page);
  if (list === 'top_rated') return { ...result, results: sortByWeightedRating(result.results) };
  // Unreleased titles often lack a synopsis, so upcoming only requires an image.
  const rules = list === 'upcoming' ? { requireImage: true } : { requireImage: true, minOverviewLength: 20 };
  return { ...result, results: refine(result.results, rules) };
}

const mixedPageSchema = pageSchema(z.unknown());

export async function getTrending(
  media: MediaType | 'all',
  window: 'day' | 'week',
  page: number,
): Promise<Paginated<MediaSummary>> {
  'use cache';
  cacheTag('tmdb', `trending:${media}`);
  // trending does not accept include_adult.
  const raw = await tmdbFetch(`trending/${media}/${window}`, { page }, mixedPageSchema);
  const results = raw.results
    .map((item) =>
      media === 'all' ? parseMediaItem(item) : parseMediaItem({ ...(item as object), media_type: media }),
    )
    .filter((i): i is MediaSummary => i !== null);
  // Trending has no watch filter: the feed post-filters it to titles available in Brazil.
  const screened = await availablePage({ page: raw.page, totalPages: raw.total_pages, totalResults: raw.total_results, results });
  screenedCacheLife(screened.unknown, 'tmdbHot');
  return screened.page;
}

const MOVIE_APPEND = 'videos,credits,release_dates,watch/providers,recommendations,external_ids';

/**
 * Errors thrown inside a 'use cache' function lose their class and fields at the cache boundary,
 * so a TMDb 404 is returned as a value and rethrown as a TmdbError outside the cache.
 */
async function loadMovieDetails(id: number): Promise<MovieDetails | null> {
  'use cache';
  cacheTag('tmdb', `movie:${id}`);
  try {
    const raw = await tmdbFetch(
      `movie/${id}`,
      { append_to_response: MOVIE_APPEND, include_video_language: 'pt,en,null' },
      movieDetailSchema,
    );
    // Adult titles behave as not found (404).
    if (raw.adult) {
      cacheLife('tmdbDetail');
      return null;
    }
    const screened = await withAvailableRecommendations(
      await withOverviewFallback(toMovieDetails(raw), () =>
        tmdbFetch(`movie/${id}`, { language: 'en-US' }, overviewOnlySchema),
      ),
    );
    screenedCacheLife(screened.unknown, 'tmdbDetail');
    return screened.details;
  } catch (error) {
    if (isTmdbNotFound(error)) {
      // A transient 404 must not stick for the full detail lifetime.
      cacheLife('hours');
      return null;
    }
    throw error;
  }
}

export async function getMovieDetails(id: number): Promise<MovieDetails> {
  const movie = await loadMovieDetails(id);
  if (!movie) throw new TmdbError('The resource you requested could not be found.', 404, `movie/${id}`);
  return movie;
}
