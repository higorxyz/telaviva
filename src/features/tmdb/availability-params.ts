import type { TmdbParams } from './client';

// Client-safe on purpose (TmdbParams is a type-only import): the Descobrir filters, which also run in the browser,
// need these values, while ./availability holds the server-only fetchers and re-exports them.

/**
 * "Available in Brazil" = at least one BR offer of these kinds. The single place to change it, e.g. to
 * 'flatrate|free|ads' for subscription and free only.
 */
export const BR_AVAILABLE_MONETIZATION = 'flatrate|free|ads|rent|buy';

/** Discover params that keep only titles available in Brazil. */
export function brAvailabilityParams(): TmdbParams {
  return { watch_region: 'BR', with_watch_monetization_types: BR_AVAILABLE_MONETIZATION };
}
