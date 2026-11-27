import { cacheLife, cacheTag } from 'next/cache';
import { z } from 'zod';
import { BR_AVAILABLE_MONETIZATION } from './availability-params';
import { isTmdbNotFound, tmdbFetch } from './client';
import type { MediaSummary, MediaType, Paginated } from './types';

// The constant lives in a client-safe module (the Descobrir filters need it in the browser); this is its entry point.
export { BR_AVAILABLE_MONETIZATION, brAvailabilityParams } from './availability-params';

export type Availability = 'yes' | 'no' | 'unknown';

/** The offer lists that count, derived from the constant so the post-filter and discover never disagree. */
const KINDS = BR_AVAILABLE_MONETIZATION.split('|');
const CHUNK = 10;
/** Provider lookups in flight per server instance, across every caller (TMDb allows about 40 requests/s per IP). */
export const MAX_PROVIDER_LOOKUPS_IN_FLIGHT = 8;

// Only BR matters; anything malformed there reads as "no offers" instead of failing the whole answer.
const providersSchema = z.object({
  results: z.object({ BR: z.record(z.string(), z.unknown()).optional().catch(undefined) }).catch({}),
});

let inFlight = 0;
const waiting: Array<() => void> = [];

/** Runs `task` once a lookup slot is free; a finished task hands its slot straight to the next waiter. */
async function withLookupSlot<T>(task: () => Promise<T>): Promise<T> {
  if (inFlight < MAX_PROVIDER_LOOKUPS_IN_FLIGHT) inFlight += 1;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else inFlight -= 1;
  }
}

/**
 * Whether a title can be watched in Brazil (`${media}/${id}/watch/providers`). Errors lose their class across the
 * cache boundary, so the answer is a value: a 404 is 'no', any other failure (a lasting 429 included) is 'unknown',
 * kept only briefly, never thrown.
 */
export async function availabilityInBr(media: MediaType, id: number): Promise<Availability> {
  'use cache';
  cacheTag('tmdb', `${media}:${id}`);
  try {
    const raw = await withLookupSlot(() => tmdbFetch(`${media}/${id}/watch/providers`, {}, providersSchema));
    cacheLife('tmdbDetail');
    const br = raw.results.BR;
    return br !== undefined && KINDS.some((kind) => Array.isArray(br[kind]) && br[kind].length > 0) ? 'yes' : 'no';
  } catch (error) {
    if (isTmdbNotFound(error)) {
      // A transient 404 must not stick for the full detail lifetime.
      cacheLife('hours');
      return 'no';
    }
    console.error(`[availability] ${media} ${id} failed:`, error);
    cacheLife('minutes');
    return 'unknown';
  }
}

/**
 * The titles available in Brazil, in their original order. A title whose lookup failed is kept (fail open) and
 * `unknown` says so, so the caller can cache its result briefly. Asks at most CHUNK titles at a time, stops as
 * soon as `limit` titles are kept, and never asks about more than `maxLookups` titles.
 */
export async function screenAvailableInBr(
  items: MediaSummary[],
  opts: { limit?: number; maxLookups?: number } = {},
): Promise<{ items: MediaSummary[]; unknown: boolean }> {
  const limit = opts.limit ?? Infinity;
  const asked = items.slice(0, opts.maxLookups ?? items.length);
  const kept: MediaSummary[] = [];
  let unknown = false;
  for (let start = 0; start < asked.length && kept.length < limit; start += CHUNK) {
    const chunk = asked.slice(start, start + CHUNK);
    const answers = await Promise.all(chunk.map((item) => availabilityInBr(item.mediaType, item.id)));
    chunk.forEach((item, i) => {
      if (answers[i] === 'no' || kept.length >= limit) return;
      if (answers[i] === 'unknown') unknown = true;
      kept.push(item);
    });
  }
  return { items: kept, unknown };
}

export async function filterAvailableInBr(
  items: MediaSummary[],
  opts: { limit?: number; maxLookups?: number } = {},
): Promise<MediaSummary[]> {
  return (await screenAvailableInBr(items, opts)).items;
}

/** A list page with only its available titles; page numbers and totals stay TMDb's, so pagination still works. */
export async function availablePage(page: Paginated<MediaSummary>): Promise<{ page: Paginated<MediaSummary>; unknown: boolean }> {
  const screened = await screenAvailableInBr(page.results);
  return { page: { ...page, results: screened.items }, unknown: screened.unknown };
}

/**
 * The cache profile of a function that screened titles: its normal one, or 'minutes' when a lookup failed, so a
 * TMDb hiccup is retried soon instead of living for the outer lifetime. Call it once, after the screening.
 */
export function screenedCacheLife(unknown: boolean, profile: 'tmdbHot' | 'tmdbDetail'): void {
  // One literal per call: cacheLife's typed overloads take a single profile name, not a union.
  if (unknown) cacheLife('minutes');
  else if (profile === 'tmdbHot') cacheLife('tmdbHot');
  else cacheLife('tmdbDetail');
}
