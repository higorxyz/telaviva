import 'server-only';
import { mergeLibraries } from '@/features/library/merge';
import { isValidLibraryState } from '@/features/library/schema';
import type { LibraryState } from '@/features/library/types';
import type { Database } from '@/server/db/client';
import { writeAtomically } from './atomic';
import { clampState } from './clamp';
import { diffStates, isEmptyDiff, type LibraryDiff } from './diff';
import { LibraryInvalidError } from './errors';
import { selectLibrary } from './rows';
import { assertWithinLimits, fromResult, loadAccountLibrary } from './store';
import { diffStatements } from './write';

/**
 * A merge only adds or replaces rows. `mergeLibraries` keeps every key of the account, so its diff never has
 * deletes; dropping them here as well makes "a merge never deletes account data" hold even if that ever changed.
 */
const upsertsOnly = (diff: LibraryDiff): LibraryDiff => ({ ...diff, deleteItems: [], deleteRatings: [], deleteMarks: [] });

/**
 * Folds the visitor's library into the user's stored one (first sign-in) and resolves to the library as stored.
 *
 * - The guest's timestamps come from the client's clock: none is kept later than `now` (see clamp.ts).
 * - Only the rows that change are written, with the newer-wins guard: each one is the newest of the account and
 *   the guest, and a newer row another device wrote after the load is kept. The rows and a fresh read of the
 *   library go in one transaction, so the answer shows what was really kept.
 * - Idempotent: the same guest again merges into an identical state, writes nothing and answers the account.
 * - Past a per-user limit it throws LibraryLimitError and writes nothing.
 */
export async function mergeGuestLibrary(
  db: Database,
  userId: string,
  guest: LibraryState,
  now: string,
): Promise<LibraryState> {
  const account = await loadAccountLibrary(db, userId);
  const merged = mergeLibraries(account, clampState(guest, now));
  if (!isValidLibraryState(merged)) throw new LibraryInvalidError();
  assertWithinLimits(account, merged);

  const diff = upsertsOnly(diffStates(account, merged));
  if (isEmptyDiff(diff)) return merged;
  const results = await writeAtomically(db, (q) => [...diffStatements(q, userId, diff, true), selectLibrary(q, userId)]);
  return fromResult(results.at(-1));
}
