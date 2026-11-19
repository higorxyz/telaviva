import { cacheLife, cacheTag } from 'next/cache';
import { z } from 'zod';
import { BR_AVAILABLE_MONETIZATION } from './availability-params';
import { isTmdbNotFound, tmdbFetch } from './client';
import type { MediaSummary, MediaType, Paginated } from './types';

// The constant lives in a client-safe module (the Descobrir filters need it in the browser); this is its entry point.
export { BR_AVAILABLE_MONETIZATION, brAvailabilityParams } from './availability-params';

/** The offer lists that count, derived from the constant so the post-filter and discover never disagree. */
const KINDS = BR_AVAILABLE_MONETIZATION.split('|');
const CHUNK = 10;

// Only BR matters; anything malformed there reads as "no offers" instead of failing the whole answer.
const providersSchema = z.object({
  results: z.object({ BR: z.record(z.string(), z.unknown()).optional().catch(undefined) }).catch({}),
});

/**
 * Whether a title can be watched in Brazil (`${media}/${id}/watch/providers`). Errors lose their class across the
 * cache boundary, so a 404 or a failure is answered as `false`, never thrown, and kept only briefly.
 */
export async function isAvailableInBr(media: MediaType, id: number): Promise<boolean> {
  'use cache';
  cacheTag('tmdb', `${media}:${id}`);
  try {
    const raw = await tmdbFetch(`${media}/${id}/watch/providers`, {}, providersSchema);
    cacheLife('tmdbDetail');
    const br = raw.results.BR;
    return br !== undefined && KINDS.some((kind) => Array.isArray(br[kind]) && br[kind].length > 0);
  } catch (error) {
    if (isTmdbNotFound(error)) {
      // A transient 404 must not stick for the full detail lifetime.
      cacheLife('hours');
    } else {
      console.error(`[availability] ${media} ${id} failed:`, error);
      cacheLife('minutes');
    }
    return false;
  }
}

/**
 * The titles available in Brazil, in their original order. Asks at most CHUNK titles at a time (each answer is
 * cached on its own) and stops as soon as `limit` titles are found.
 */
export async function filterAvailableInBr(
  items: MediaSummary[],
  opts: { limit?: number } = {},
): Promise<MediaSummary[]> {
  const limit = opts.limit ?? Infinity;
  const kept: MediaSummary[] = [];
  for (let start = 0; start < items.length && kept.length < limit; start += CHUNK) {
    const chunk = items.slice(start, start + CHUNK);
    const available = await Promise.all(chunk.map((item) => isAvailableInBr(item.mediaType, item.id)));
    chunk.forEach((item, i) => {
      if (available[i] && kept.length < limit) kept.push(item);
    });
  }
  return kept;
}

/** A list page with only its available titles; page numbers and totals stay TMDb's, so pagination still works. */
export async function availablePage(page: Paginated<MediaSummary>): Promise<Paginated<MediaSummary>> {
  return { ...page, results: await filterAvailableInBr(page.results) };
}

/** Details whose "Você também pode gostar" keeps only titles available in Brazil (the title itself is never hidden). */
export async function withAvailableRecommendations<T extends { recommendations: MediaSummary[] }>(details: T): Promise<T> {
  return { ...details, recommendations: await filterAvailableInBr(details.recommendations) };
}
