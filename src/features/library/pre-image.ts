import { findItem, findRating, type LibraryCommand } from './commands';
import { parseLibraryEntries } from './schema';
import type { EpisodeMark, LibraryItem, LibraryState, Rating, TitleRef } from './types';

/**
 * One title as it was right before a command: its item, its rating and (for a series) its episode marks. Undo puts
 * exactly this back. Signed in, the server takes it from the state it loaded for the command, so a tab that stayed
 * open for hours never undoes a change another device made in between.
 */
export type TitlePreImage = { item: LibraryItem | null; rating: Rating | null; marks: EpisodeMark[] };

/** The title a command acts on. */
export function refOfCommand(command: LibraryCommand): TitleRef {
  return command.type === 'setEpisodes' ? { mediaType: 'tv', tmdbId: command.tvId } : command.ref;
}

export function titlePreImage(state: LibraryState, ref: TitleRef): TitlePreImage {
  return {
    item: findItem(state, ref) ?? null,
    rating: findRating(state, ref) ?? null,
    marks: ref.mediaType === 'tv' ? state.episodes.filter((e) => e.tvId === ref.tmdbId) : [],
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A pre-image read from the network, checked with the library's own row schemas; null when anything in it is off
 * (then no undo is offered rather than one built from a guess).
 */
export function parsePreImage(raw: unknown): TitlePreImage | null {
  if (!isRecord(raw) || !Array.isArray(raw.marks)) return null;
  const items = raw.item === null ? [] : [raw.item];
  const ratings = raw.rating === null ? [] : [raw.rating];
  const parsed = parseLibraryEntries({ version: 1, items, ratings, episodes: raw.marks });
  if (!parsed || parsed.dropped > 0) return null;
  const { state } = parsed;
  return { item: state.items[0] ?? null, rating: state.ratings[0] ?? null, marks: state.episodes };
}
