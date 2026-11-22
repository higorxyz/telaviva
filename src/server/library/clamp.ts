import type { EpisodeMark, LibraryItem, LibraryState, Rating } from '@/features/library/types';
import { LibraryStaleError } from './errors';

/**
 * Timestamps that come from a client (an undo's cached rows, a visitor's library) are never stored later than the
 * server's `now`. Writes are guarded newer-wins, so a timestamp in the future (a device clock ahead, or a forged
 * one) would freeze the row: every later write, stamped with the server's `now`, would look older and be skipped.
 */

const notAfter = (value: string, now: string) => (Date.parse(value) > Date.parse(now) ? now : value);

export const clampItem = (item: LibraryItem, now: string): LibraryItem => ({
  ...item,
  addedAt: notAfter(item.addedAt, now),
  updatedAt: notAfter(item.updatedAt, now),
  watchedAt: item.watchedAt && notAfter(item.watchedAt, now),
});

export const clampRating = (rating: Rating, now: string): Rating => ({
  ...rating,
  ratedAt: notAfter(rating.ratedAt, now),
  updatedAt: notAfter(rating.updatedAt, now),
});

export const clampMark = (mark: EpisodeMark, now: string): EpisodeMark => ({
  ...mark,
  watchedAt: notAfter(mark.watchedAt, now),
});

/** The whole library with every timestamp brought back to `now` at the latest. */
export function clampState(state: LibraryState, now: string): LibraryState {
  return {
    version: 1,
    items: state.items.map((i) => clampItem(i, now)),
    episodes: state.episodes.map((m) => clampMark(m, now)),
    ratings: state.ratings.map((r) => clampRating(r, now)),
  };
}

/** How old an action from the offline queue may be (plan, "Valores fixados"): the queue drops anything older. */
export const MAX_ACTION_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The time a command is written with: the time the action was done on the device (`at`), never later than `now`,
 * or `now` itself when the command carries none. Throws LibraryStaleError for an action more than 30 days old.
 */
export function actionTime(at: string | undefined, now: string): string {
  if (at === undefined) return now;
  const time = Date.parse(at);
  if (time < Date.parse(now) - MAX_ACTION_AGE_MS) throw new LibraryStaleError();
  return notAfter(new Date(time).toISOString(), now);
}
