import { cacheLife, cacheTag } from 'next/cache';
import { tmdbFetch } from './client';
import { providerCatalogSchema } from './detail-schemas';
import { genreListSchema } from './schemas';
import type { Genre, MediaType, Provider } from './types';

export async function getGenres(media: MediaType): Promise<Genre[]> {
  'use cache';
  cacheLife('tmdbStatic');
  cacheTag('tmdb', `genres:${media}`);
  const raw = await tmdbFetch(`genre/${media}/list`, {}, genreListSchema);
  return raw.genres;
}

const NO_PRIORITY = Number.MAX_SAFE_INTEGER;

export async function getWatchProviderCatalog(media: MediaType): Promise<Provider[]> {
  'use cache';
  cacheLife('tmdbStatic');
  cacheTag('tmdb', `providers:${media}`);
  const raw = await tmdbFetch(`watch/providers/${media}`, { watch_region: 'BR' }, providerCatalogSchema);
  return raw.results
    .map((p) => ({
      priority: p.display_priorities.BR ?? NO_PRIORITY,
      provider: { id: p.provider_id, name: p.provider_name, logoPath: p.logo_path },
    }))
    .sort((a, b) => a.priority - b.priority)
    .map((p) => p.provider);
}
