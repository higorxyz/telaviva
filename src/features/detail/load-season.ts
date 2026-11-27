import { isTmdbNotFound } from '@/features/tmdb/client';
import { getSeason } from '@/features/tmdb/tv';
import type { SeasonDetails } from '@/features/tmdb/types';

export type SeasonResult =
  | { status: 'ok'; season: SeasonDetails }
  | { status: 'missing' }
  | { status: 'error' };

/** Only a TMDb 404 means "missing"; anything else is logged and shown as a load failure. */
export async function loadSeason(tvId: number, seasonNumber: number): Promise<SeasonResult> {
  try {
    return { status: 'ok', season: await getSeason(tvId, seasonNumber) };
  } catch (error) {
    if (isTmdbNotFound(error)) return { status: 'missing' };
    console.error(`Failed to load season ${seasonNumber} of tv ${tvId}`, error);
    return { status: 'error' };
  }
}
