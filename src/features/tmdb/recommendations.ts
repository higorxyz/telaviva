import { cacheLife, cacheTag } from 'next/cache';
import { screenAvailableInBr, screenedCacheLife } from './availability';
import { isTmdbNotFound, tmdbFetch } from './client';
import { toMediaSummary, toPaginated } from './mappers';
import { moviePageSchema, tvPageSchema } from './schemas';
import type { MediaSummary, MediaType } from './types';

/**
 * Page-1 recommendations for a title, with `mediaType` forced (the endpoint omits it), limited to titles available
 * in Brazil, at most `limit` of them (fewer provider lookups). Adult results are dropped by `toPaginated`. A 404
 * returns `[]`, as a value, since errors lose their class across the cache.
 */
export async function getRecommendationsFor(media: MediaType, id: number, limit: number): Promise<MediaSummary[]> {
  'use cache';
  cacheTag('tmdb', `${media}:${id}`);
  try {
    const path = `${media}/${id}/recommendations`;
    const page =
      media === 'movie'
        ? toPaginated(await tmdbFetch(path, { page: 1 }, moviePageSchema), (r) => toMediaSummary(r, 'movie'))
        : toPaginated(await tmdbFetch(path, { page: 1 }, tvPageSchema), (r) => toMediaSummary(r, 'tv'));
    const screened = await screenAvailableInBr(page.results, { limit });
    screenedCacheLife(screened.unknown, 'tmdbDetail');
    return screened.items;
  } catch (error) {
    if (isTmdbNotFound(error)) {
      cacheLife('tmdbDetail');
      return [];
    }
    throw error;
  }
}
