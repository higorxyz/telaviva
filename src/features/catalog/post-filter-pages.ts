import type { MediaSummary, Paginated } from '@/features/tmdb/types';
import { mediaKey } from './media-key';

// Paging helpers for lists post-filtered to titles available in Brazil, whose pages can come back short or empty.

type PageFetcher = (page: number) => Promise<Paginated<MediaSummary>>;

/** Below this many titles, a rail also takes the next page (so it keeps at least 6 after cross-rail dedupe). */
const TOP_UP_BELOW = 12;
/** How many further pages an empty page may be replaced by. */
const MAX_SKIPS = 3;
/** TMDb refuses pages above 500. */
const LAST_TMDB_PAGE = 500;

/** Page 1 for a rail, topped up with page 2 when it is short. A page 1 failure rejects; a page 2 failure is ignored. */
export async function fetchRailPage(fetch: PageFetcher): Promise<Paginated<MediaSummary>> {
  const first = await fetch(1);
  if (first.results.length >= TOP_UP_BELOW || first.totalPages <= 1) return first;
  try {
    const second = await fetch(2);
    const seen = new Set<string>();
    const results = [...first.results, ...second.results].filter((item) => {
      const key = mediaKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { ...first, results };
  } catch (error) {
    console.error('[rails] top-up page failed:', error);
    return first;
  }
}

/**
 * Page `page` of a post-filtered list for infinite scroll. An empty page is replaced by the next one, up to
 * MAX_SKIPS times, and `page` reports the page actually used so the client continues after it. An empty result
 * is still possible at the end (or after the skips), and then `page` never runs past `totalPages`.
 */
export async function fetchFilledPage(fetch: PageFetcher, page: number): Promise<Paginated<MediaSummary>> {
  let current = page;
  let result = await fetch(current);
  for (let skips = 0; skips < MAX_SKIPS; skips += 1) {
    if (result.results.length > 0 || current >= result.totalPages || current >= LAST_TMDB_PAGE) break;
    try {
      result = await fetch(current + 1);
    } catch (error) {
      // Keep the empty page we have: the client asks for the next one on its own.
      console.error(`[catalog] page ${current + 1} failed while skipping an empty page:`, error);
      break;
    }
    current += 1;
  }
  return { ...result, page: current };
}
