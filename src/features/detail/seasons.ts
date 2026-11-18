import type { SeasonSummary, TvDetails } from '@/features/tmdb/types';

const STATUS: Record<string, string> = {
  'Returning Series': 'Em exibição',
  Ended: 'Finalizada',
  Canceled: 'Cancelada',
  'In Production': 'Em produção',
  Planned: 'Planejada',
  Pilot: 'Piloto',
};

/** Portuguese label for a TMDb series status; unknown values pass through. */
export function statusLabel(status: string): string {
  return STATUS[status] ?? status;
}

export function seasonLabel(season: Pick<SeasonSummary, 'seasonNumber'>): string {
  return season.seasonNumber === 0 ? 'Especiais' : `Temporada ${season.seasonNumber}`;
}

/** Regular seasons ascending, then season 0 as "Especiais"; drops empty seasons that never aired. */
export function orderSeasons(seasons: SeasonSummary[]): SeasonSummary[] {
  const kept = seasons.filter((s) => s.episodeCount > 0 || s.airDate !== null);
  const regular = kept.filter((s) => s.seasonNumber > 0).sort((a, b) => a.seasonNumber - b.seasonNumber);
  const specials = kept.filter((s) => s.seasonNumber === 0).map((s) => ({ ...s, name: 'Especiais' }));
  return [...regular, ...specials];
}

/** Season of the last aired episode, else the first listed season, else null. */
export function defaultSeason(tv: TvDetails): number | null {
  const ordered = orderSeasons(tv.seasons);
  const last = tv.lastEpisodeToAir?.seasonNumber;
  if (last !== undefined && ordered.some((s) => s.seasonNumber === last)) return last;
  return ordered[0]?.seasonNumber ?? null;
}

/** Validates the `?temporada=` value against the available seasons. */
export function parseSeasonParam(
  value: string | string[] | undefined,
  ordered: SeasonSummary[],
): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return ordered.some((s) => s.seasonNumber === n) ? n : null;
}
