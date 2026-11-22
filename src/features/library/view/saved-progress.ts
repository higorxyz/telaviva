import { readDeviceMeta, writeDeviceMeta } from '@/features/offline/device-meta';
import type { EpisodeRef, TvProgressInfo } from '../progress';

/**
 * The last series progress the server sent, kept on the device per identity (`meta` key `progress:<identity>`), so
 * "Continue assistindo" and "Próximo: T…E…" still show offline. The service worker cannot keep it: the request's URL is
 * the list of series, which changes with the library. Kept as one list of the newest answer per series (answers for
 * different id sets merge), at most {@link SAVED_PROGRESS_LIMIT} series, the oldest answers dropped first. Nothing is
 * read or kept while the identity is still `pending`. Signing out wipes the account's copy (wipeAccount).
 */
export const SAVED_PROGRESS_LIMIT = 1_000;

const PENDING = 'pending';
const keyOf = (identity: string) => `progress:${identity}`;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

function isEpisode(value: unknown): value is EpisodeRef {
  return isObject(value) && isCount(value.seasonNumber) && isCount(value.episodeNumber);
}

const isAirDate = (value: object) =>
  'airDate' in value && (value.airDate === null || typeof value.airDate === 'string');

function isInfo(value: unknown): value is TvProgressInfo {
  return (
    isObject(value) &&
    isCount(value.tvId) &&
    typeof value.ended === 'boolean' &&
    Array.isArray(value.seasons) &&
    value.seasons.every((s) => isObject(s) && isCount(s.seasonNumber) && isCount(s.episodeCount)) &&
    (value.lastAired === null || isEpisode(value.lastAired)) &&
    (value.nextToAir === null || (isEpisode(value.nextToAir) && isAirDate(value.nextToAir)))
  );
}

/** The stored list, keeping only well-formed entries (a broken copy reads as nothing kept). */
function parse(value: unknown): TvProgressInfo[] {
  return Array.isArray(value) ? value.filter(isInfo) : [];
}

/** The kept progress of these series for this identity only, or null when none of them is kept. */
export async function readSavedProgress(
  identity: string,
  ids: number[],
): Promise<Record<string, TvProgressInfo> | null> {
  if (identity === PENDING) return null;
  const wanted = new Set(ids);
  const kept = parse(await readDeviceMeta(keyOf(identity))).filter((info) => wanted.has(info.tvId));
  return kept.length > 0 ? Object.fromEntries(kept.map((info) => [String(info.tvId), info])) : null;
}

/** Saves run one at a time, so two answers arriving together cannot drop each other's series. */
let tail: Promise<void> = Promise.resolve();

/** Merges a server answer into this identity's kept progress. Best effort: never throws. */
export function saveProgress(identity: string, answer: Record<string, TvProgressInfo>): Promise<void> {
  if (identity === PENDING) return Promise.resolve();
  const run = tail.then(async () => {
    const fresh = Object.values(answer).filter(isInfo);
    if (fresh.length === 0) return;
    const ids = new Set(fresh.map((info) => info.tvId));
    const older = parse(await readDeviceMeta(keyOf(identity))).filter((info) => !ids.has(info.tvId));
    await writeDeviceMeta(keyOf(identity), [...older, ...fresh].slice(-SAVED_PROGRESS_LIMIT));
  });
  tail = run.catch(() => {});
  return tail;
}
