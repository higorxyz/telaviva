import { airedEpisodes, seriesProgress, type TvProgressInfo } from '../library/progress';
import type { EpisodeMark, LibraryItem } from '../library/types';
import { mediaHref } from '@/lib/slug';
import { WARM_HEADER } from '@/sw/warm-header';

/** Series saved for offline: the ones being watched, updated most recently (plan, "Valores fixados"). */
export const WARM_LIMIT = 12;
/** A series is saved again at most this often. */
export const WARM_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** One request of a warm-up; `key` is the series it belongs to (`tv:<id>`), whose time is kept once all are done. */
export type WarmStep = { url: string; key: string };
/** The library data the seasons to save are derived from: series progress from TMDb and the episodes marked. */
export type WarmContext = { progress: Record<string, TvProgressInfo>; episodes: EpisodeMark[] };
/** When each series was last saved for offline (ISO 8601), by key. */
export type LastWarm = Record<string, string>;

/** The key of a series in the warm-up record. */
export const warmKey = (tmdbId: number) => `tv:${tmdbId}`;

/** The series being watched, most recently updated first, at most {@link WARM_LIMIT}. */
export function seriesToWarm(items: LibraryItem[]): LibraryItem[] {
  return items
    .filter((item) => item.mediaType === 'tv' && item.status === 'watching')
    .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0))
    .slice(0, WARM_LIMIT);
}

/**
 * The season being watched and the one after it, when TMDb lists one: the season of the next episode to watch; for a
 * series not started, the first aired season; for one caught up or finished, the latest aired season (the next one
 * being the season announced after it).
 */
export function warmSeasons(info: TvProgressInfo, marks: EpisodeMark[]): number[] {
  const seasons = info.seasons.map((s) => s.seasonNumber).filter((n) => n > 0);
  if (seasons.length === 0) return [];
  const progress = seriesProgress(info, marks);
  const aired = airedEpisodes(info);
  const current =
    progress.kind === 'in-progress'
      ? progress.next.seasonNumber
      : ((progress.kind === 'not-started' ? aired[0] : aired.at(-1))?.seasonNumber ?? seasons[0]);
  const next = seasons.find((n) => n > current);
  return next === undefined ? [current] : [current, next];
}

/**
 * What saves the given series for offline, with no regard to time: for each of the {@link seriesToWarm}, its page (the
 * URL the app links to, so the saved copy is found) and its {@link warmSeasons}. A series whose progress is not known
 * yet is left out: its seasons cannot be chosen.
 */
export function warmTargets(items: LibraryItem[], context: WarmContext): { key: string; urls: string[] }[] {
  const targets: { key: string; urls: string[] }[] = [];
  for (const item of seriesToWarm(items)) {
    const info = context.progress[String(item.tmdbId)];
    if (!info) continue;
    const marks = context.episodes.filter((e) => e.tvId === item.tmdbId);
    const page = mediaHref({ mediaType: 'tv', id: item.tmdbId, title: item.snapshot.title });
    const seasons = warmSeasons(info, marks).map((n) => `/api/tv/${item.tmdbId}/season/${n}`);
    targets.push({ key: warmKey(item.tmdbId), urls: [page, ...seasons] });
  }
  return targets;
}

/** True when the series was saved less than {@link WARM_INTERVAL_MS} before `now`. A time in the future is not. */
function warmedRecently(last: string | undefined, now: number): boolean {
  if (last === undefined) return false;
  const elapsed = now - Date.parse(last);
  return elapsed >= 0 && elapsed < WARM_INTERVAL_MS;
}

/**
 * The requests that save the series being watched for offline, in order: {@link warmTargets} minus the series saved
 * less than 6 h before `now` (ISO 8601). The 12 series are chosen first, so a skipped one is not replaced by an older one.
 */
export function planWarmUp(items: LibraryItem[], lastWarm: LastWarm, now: string, context: WarmContext): WarmStep[] {
  const at = Date.parse(now);
  return warmTargets(items, context)
    .filter((target) => !warmedRecently(lastWarm[target.key], at))
    .flatMap((target) => target.urls.map((url) => ({ url, key: target.key })));
}

/**
 * Headers of a warm-up request. A page is asked for as a document with the warm-up header, which the worker stores in
 * `tv-pages` under the page URL, like a visit. A season is a plain catalog request, stored in `tv-catalog-api`.
 */
export function warmHeaders(url: string): Record<string, string> {
  return url.startsWith('/api/') ? {} : { [WARM_HEADER]: '1', Accept: 'text/html' };
}

/** The stored record, keeping only well-formed entries (anything else reads as never saved). */
export function parseLastWarm(value: unknown): LastWarm {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && !Number.isNaN(Date.parse(entry[1])),
    ),
  );
}

/** The record without the series no longer saved for offline, so it never grows past {@link WARM_LIMIT} entries. */
export function keepWarmEntries(lastWarm: LastWarm, keys: string[]): LastWarm {
  return Object.fromEntries(Object.entries(lastWarm).filter(([key]) => keys.includes(key)));
}
