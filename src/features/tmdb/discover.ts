import { cacheLife, cacheTag } from 'next/cache';
import { tmdbFetch, type TmdbParams } from './client';
import { toMediaSummary, toPaginated } from './mappers';
import { moviePageSchema, tvPageSchema } from './schemas';
import type { MediaSummary, MediaType, Paginated } from './types';

/** Uncached discover request, shared by the list functions. Always sends include_adult=false. */
export async function fetchDiscover(
  media: MediaType,
  params: TmdbParams,
  page: number,
): Promise<Paginated<MediaSummary>> {
  const query = { ...params, include_adult: false, page };
  if (media === 'movie') {
    return toPaginated(await tmdbFetch('discover/movie', query, moviePageSchema), (r) =>
      toMediaSummary(r, 'movie'),
    );
  }
  return toPaginated(await tmdbFetch('discover/tv', query, tvPageSchema), (r) => toMediaSummary(r, 'tv'));
}

/** `params` already in TMDb format (see Task 14 `toTmdbParams`). */
export async function discover(
  media: MediaType,
  params: TmdbParams,
  page = 1,
): Promise<Paginated<MediaSummary>> {
  'use cache';
  cacheLife('tmdbHot');
  cacheTag('tmdb', `discover:${media}`);
  return fetchDiscover(media, params, page);
}
