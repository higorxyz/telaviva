import { cacheLife, cacheTag } from 'next/cache';
import { sortByWeightedRating } from '@/features/catalog/curation';
import { tmdbFetch } from './client';
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

export async function getTvDetails(id: number): Promise<TvDetails> {
  'use cache';
  cacheLife('tmdbDetail');
  cacheTag('tmdb', `tv:${id}`);
  const raw = await tmdbFetch(
    `tv/${id}`,
    { append_to_response: TV_APPEND, include_video_language: 'pt,en,null' },
    tvDetailSchema,
  );
  return withOverviewFallback(toTvDetails(raw), () =>
    tmdbFetch(`tv/${id}`, { language: 'en-US' }, overviewOnlySchema),
  );
}

export async function getSeason(tvId: number, season: number): Promise<SeasonDetails> {
  'use cache';
  cacheLife('tmdbDetail');
  cacheTag('tmdb', `tv:${tvId}`);
  const raw = await tmdbFetch(`tv/${tvId}/season/${season}`, {}, seasonSchema);
  return {
    seasonNumber: raw.season_number,
    name: raw.name,
    overview: raw.overview,
    episodes: raw.episodes.map(toEpisode),
  };
}
