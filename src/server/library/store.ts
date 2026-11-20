import 'server-only';
import { applyCommand, type LibraryCommand } from '@/features/library/commands';
import { LIBRARY_LIMITS } from '@/features/library/limits';
import { isValidLibraryState, normalizeLibraryState, parseLibraryEntries } from '@/features/library/schema';
import { EMPTY_LIBRARY, type LibraryState } from '@/features/library/types';
import type { Database } from '@/server/db/client';
import { writeAtomically } from './atomic';
import { diffStates, isEmptyDiff } from './diff';
import { LibraryConflictError, LibraryInvalidError, LibraryLimitError } from './errors';
import { assertExpected, clampRestore, expectedGuard, isGuardAbort } from './restore';
import { selectLibrary, toRawLibrary } from './rows';
import { diffStatements } from './write';

/**
 * The library of a signed-in user, kept in Postgres and changed only through the same `applyCommand` reducer the
 * visitor's local library uses: load, apply, then write just the rows that changed.
 *
 * Concurrency: load → apply → write is not serialized across requests. Writes are per-row upserts and deletes, so
 * two devices changing different rows never clobber each other; on the same row the newer `updatedAt` wins (see
 * `diffStatements`), and a delete wins over anything written before it.
 */

/** Validates the rows read from the database. A row the schema cannot read is left out, never rewritten. */
export function fromResult(result: unknown): LibraryState {
  const parsed = parseLibraryEntries(toRawLibrary(result));
  if (!parsed) return EMPTY_LIBRARY;
  if (parsed.dropped > 0) {
    // Counts only: the rows hold the user's data.
    console.warn(`[library] left out ${parsed.dropped} unreadable row(s)`);
  }
  return normalizeLibraryState(parsed.state);
}

export async function loadLibrary(db: Database, userId: string): Promise<LibraryState> {
  return fromResult(await selectLibrary(db, userId));
}

/** Refuses growing past a limit; a library already over it may still shrink or change in place. */
export function assertWithinLimits(before: LibraryState, after: LibraryState): void {
  const checks = [
    ['items', before.items.length, after.items.length, LIBRARY_LIMITS.items],
    ['ratings', before.ratings.length, after.ratings.length, LIBRARY_LIMITS.ratings],
    ['marks', before.episodes.length, after.episodes.length, LIBRARY_LIMITS.marks],
  ] as const;
  for (const [limit, was, now, max] of checks) {
    if (now > max && now > was) throw new LibraryLimitError(limit);
  }
}

function reduce(before: LibraryState, command: LibraryCommand, now: string): LibraryState {
  let after: LibraryState;
  try {
    // normalize: a restore listing the same mark twice must not reach the database as two rows.
    after = normalizeLibraryState(applyCommand(before, command, now));
  } catch (cause) {
    throw new LibraryInvalidError({ cause });
  }
  if (!isValidLibraryState(after)) throw new LibraryInvalidError();
  return after;
}

/**
 * Applies one command for the user and resolves to the library as stored afterwards. The changed rows and a fresh
 * read of the library go in one transaction, so the answer shows what was really kept (a guarded upsert may have
 * kept a newer row) and nothing is written when any statement fails.
 */
export async function applyLibraryCommand(
  db: Database,
  userId: string,
  command: LibraryCommand,
  now: string,
): Promise<LibraryState> {
  const before = await loadLibrary(db, userId);
  const applied = command.type === 'restore' ? clampRestore(command, now) : command;
  if (applied.type === 'restore') assertExpected(before, applied);
  const after = reduce(before, applied, now);
  assertWithinLimits(before, after);

  const diff = diffStates(before, after);
  if (isEmptyDiff(diff)) return after;
  // A restore re-checks its fingerprint inside the transaction, so a write landing after the load aborts it.
  const guard = applied.type === 'restore' && applied.expected ? { ref: applied.ref, expected: applied.expected } : null;
  try {
    const results = await writeAtomically(db, (q) => [
      ...(guard ? [expectedGuard(q, userId, guard.ref, guard.expected)] : []),
      ...diffStatements(q, userId, diff, applied.type !== 'restore'),
      selectLibrary(q, userId),
    ]);
    return fromResult(results.at(-1));
  } catch (error) {
    if (isGuardAbort(error)) throw new LibraryConflictError();
    throw error;
  }
}
