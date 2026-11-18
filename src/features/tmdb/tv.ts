import { cacheLife, cacheTag } from 'next/cache';
import { sortByWeightedRating } from '@/features/catalog/curation';
import { isTmdbNotFound, TmdbError, tmdbFetch } from './client';
import { toEpisode, toTvDetails } from './detail-mappers';
import { overviewOnlySchema, seasonSchema, tvDetailSchema } from './detail-schemas';
import { fetchDiscover } from './discover';
import { toMediaSummary, toPaginated, withOverviewFallback } from './mappers';
import { tvPageSchema } from './schemas';
import type { MediaSummary, Paginated, SeasonDetails, TvDetails } from './types';

export type TvListKey = 'airing_today' | 'on_the_air' | 'popular' | 'top_rated';

export async function getTvList(list: TvListKey, page = 1): Promise<Paginated<MediaSummary>> {
  'use cache';
  cacheLife('tmdbHot');
  cacheTag('tmdb', `tv-list:${list}`);
  if (list === 'top_rated') {
    const result = await fetchDiscover(
      'tv',
      { 'vote_count.gte': 500, sort_by: 'vote_average.desc' },
      page,
    );
    return { ...result, results: sortByWeightedRating(result.results, 500) };
  }
  const raw = await tmdbFetch(
    `tv/${list}`,
    { page, ...(list === 'airing_today' ? { timezone: 'America/Sao_Paulo' } : {}) },
    tvPageSchema,
  );
  return toPaginated(raw, (r) => toMediaSummary(r, 'tv'));
}

const TV_APPEND = 'videos,aggregate_credits,content_ratings,watch/providers,recommendations';

/**
 * Errors thrown inside a 'use cache' function lose their class and fields at the cache boundary,
 * so a TMDb 404 is returned as a value and rethrown as a TmdbError outside the cache.
 */
async function loadTvDetails(id: number): Promise<TvDetails | null> {
  'use cache';
  cacheTag('tmdb', `tv:${id}`);
  try {
    const raw = await tmdbFetch(
      `tv/${id}`,
      { append_to_response: TV_APPEND, include_video_language: 'pt,en,null' },
      tvDetailSchema,
    );
    const tv = await withOverviewFallback(toTvDetails(raw), () =>
      tmdbFetch(`tv/${id}`, { language: 'en-US' }, overviewOnlySchema),
    );
    cacheLife('tmdbDetail');
    return tv;
  } catch (error) {
    if (isTmdbNotFound(error)) {
      // A transient 404 must not stick for the full detail lifetime.
      cacheLife('hours');
      return null;
    }
    throw error;
  }
}

export async function getTvDetails(id: number): Promise<TvDetails> {
  const tv = await loadTvDetails(id);
  if (!tv) throw new TmdbError('The resource you requested could not be found.', 404, `tv/${id}`);
  return tv;
}

async function loadSeason(tvId: number, season: number): Promise<SeasonDetails | null> {
  'use cache';
  cacheTag('tmdb', `tv:${tvId}`);
  try {
    const raw = await tmdbFetch(`tv/${tvId}/season/${season}`, {}, seasonSchema);
    cacheLife('tmdbDetail');
    return {
      seasonNumber: raw.season_number,
      name: raw.name,
      overview: raw.overview,
      episodes: raw.episodes.map(toEpisode),
    };
  } catch (error) {
    if (isTmdbNotFound(error)) {
      cacheLife('hours');
      return null;
    }
    throw error;
  }
}

export async function getSeason(tvId: number, season: number): Promise<SeasonDetails> {
  const details = await loadSeason(tvId, season);
  if (!details) {
    throw new TmdbError('The resource you requested could not be found.', 404, `tv/${tvId}/season/${season}`);
  }
  return details;
}
