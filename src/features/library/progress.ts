import type { TvDetails } from '../tmdb/types';
import type { EpisodeMark } from './types';

export interface EpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
}

/** Shape of the TMDb data series progress is derived from. */
export interface TvProgressInfo {
  tvId: number;
  ended: boolean;
  seasons: { seasonNumber: number; episodeCount: number }[];
  lastAired: EpisodeRef | null;
  nextToAir: (EpisodeRef & { airDate: string | null }) | null;
}

export type SeriesProgress =
  | { kind: 'not-started' }
  | { kind: 'in-progress'; next: EpisodeRef; watched: number; total: number }
  | { kind: 'caught-up'; nextAirDate: string | null; watched: number; total: number }
  | { kind: 'finished'; watched: number; total: number };

export function toProgressInfo(
  tv: Pick<TvDetails, 'id' | 'status' | 'seasons' | 'lastEpisodeToAir' | 'nextEpisodeToAir'>,
): TvProgressInfo {
  return {
    tvId: tv.id,
    ended: tv.status === 'Ended' || tv.status === 'Canceled',
    seasons: tv.seasons
      .filter((s) => s.seasonNumber > 0 && s.episodeCount > 0)
      .map((s) => ({ seasonNumber: s.seasonNumber, episodeCount: s.episodeCount }))
      .sort((a, b) => a.seasonNumber - b.seasonNumber),
    lastAired: tv.lastEpisodeToAir
      ? { seasonNumber: tv.lastEpisodeToAir.seasonNumber, episodeNumber: tv.lastEpisodeToAir.episodeNumber }
      : null,
    nextToAir: tv.nextEpisodeToAir
      ? {
          seasonNumber: tv.nextEpisodeToAir.seasonNumber,
          episodeNumber: tv.nextEpisodeToAir.episodeNumber,
          airDate: tv.nextEpisodeToAir.airDate,
        }
      : null,
  };
}

function allEpisodes(info: TvProgressInfo): EpisodeRef[] {
  const out: EpisodeRef[] = [];
  for (const s of info.seasons) {
    if (s.seasonNumber <= 0) continue;
    for (let e = 1; e <= s.episodeCount; e++) out.push({ seasonNumber: s.seasonNumber, episodeNumber: e });
  }
  return out;
}

const before = (a: EpisodeRef, b: EpisodeRef) =>
  a.seasonNumber < b.seasonNumber || (a.seasonNumber === b.seasonNumber && a.episodeNumber < b.episodeNumber);

/** Regular episodes that have aired, in order. Bounded by lastAired, else by nextToAir, else by `ended`. */
export function airedEpisodes(info: TvProgressInfo): EpisodeRef[] {
  const all = allEpisodes(info);
  if (info.lastAired && info.lastAired.seasonNumber > 0) {
    const last = info.lastAired;
    return all.filter((ep) => !before(last, ep));
  }
  if (info.nextToAir && info.nextToAir.seasonNumber > 0) {
    const next = info.nextToAir;
    return all.filter((ep) => before(ep, next));
  }
  return info.ended ? all : [];
}

export function episodeCode(ref: EpisodeRef): string {
  return `T${ref.seasonNumber}E${ref.episodeNumber}`;
}

const refKey = (r: EpisodeRef) => `${r.seasonNumber}:${r.episodeNumber}`;

export function seriesProgress(info: TvProgressInfo, marks: EpisodeMark[]): SeriesProgress {
  const aired = airedEpisodes(info);
  const marked = new Set(marks.filter((m) => m.tvId === info.tvId && m.seasonNumber > 0).map(refKey));
  const watched = aired.filter((ep) => marked.has(refKey(ep))).length;
  const total = aired.length;
  if (watched === 0) return { kind: 'not-started' };
  const next = aired.find((ep) => !marked.has(refKey(ep)));
  if (next) return { kind: 'in-progress', next, watched, total };
  if (info.ended) return { kind: 'finished', watched, total };
  return { kind: 'caught-up', nextAirDate: info.nextToAir?.airDate ?? null, watched, total };
}

/** Aired regular episodes up to and including the target. */
export function marksUpTo(info: TvProgressInfo, target: EpisodeRef): EpisodeRef[] {
  return airedEpisodes(info).filter((ep) => !before(target, ep));
}
