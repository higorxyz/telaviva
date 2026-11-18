import { cacheLife, cacheTag } from 'next/cache';
import { z } from 'zod';
import { tmdbFetch } from './client';
import { parseSearchItem } from './media-item';
import { pageSchema } from './schemas';
import type { Paginated, SearchItem } from './types';

const searchPageSchema = pageSchema(z.unknown());

export async function searchMulti(query: string, page = 1): Promise<Paginated<SearchItem>> {
  'use cache';
  cacheLife('tmdbHot');
  cacheTag('tmdb', 'search');
  const q = query.trim();
  if (q === '') return { page: 1, totalPages: 0, totalResults: 0, results: [] };
  const raw = await tmdbFetch('search/multi', { query: q, include_adult: false, page }, searchPageSchema);
  const results = raw.results.map(parseSearchItem).filter((i): i is SearchItem => i !== null);
  return { page: raw.page, totalPages: raw.total_pages, totalResults: raw.total_results, results };
}
