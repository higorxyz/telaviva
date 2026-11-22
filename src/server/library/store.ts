import 'server-only';
import { applyCommand, type LibraryCommand } from '@/features/library/commands';
import { LIBRARY_LIMITS } from '@/features/library/limits';
import { refOfCommand, titlePreImage, type TitlePreImage } from '@/features/library/pre-image';
import { isValidLibraryState, normalizeLibraryState, parseLibraryEntries } from '@/features/library/schema';
import { EMPTY_LIBRARY, type LibraryState } from '@/features/library/types';
import type { Database } from '@/server/db/client';
import { appliedStatement, forgetOldCommands, isDuplicateCommand } from './applied';
import { writeAtomically } from './atomic';
import { actionTime } from './clamp';
import { diffStates, isEmptyDiff } from './diff';
import { LibraryAccountMissingError, LibraryConflictError, LibraryInvalidError, LibraryLimitError } from './errors';
import { forgetOldRemovals, isEmptyPlan, loadRemovals, planRemovals, removalStatements } from './removals';
import { assertExpected, clampRestore, expectedGuard, isGuardAbort } from './restore';
import { hasAccount, selectLibrary, toRawLibrary } from './rows';
import { diffStatements } from './write';

/**
 * The library of a signed-in user, kept in Postgres and changed only through the same `applyCommand` reducer the
 * visitor's local library uses: load, apply, then write just the rows that changed.
 *
 * Concurrency: load → apply → write is not serialized across requests. Writes are per-row upserts and deletes, so
 * two devices changing different rows never clobber each other; on the same row the newer change wins (see
 * `diffStatements`): an upsert never replaces a newer row, a delete never removes a row changed after it, and a
 * removal marker keeps a late write from bringing back a row removed after it (see removals.ts).
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

/**
 * The library of a user who must still have an account (every library route): the same single statement, which
 * also says whether the user's row exists. Throws LibraryAccountMissingError when it is gone.
 */
export async function loadAccountLibrary(db: Database, userId: string): Promise<LibraryState> {
  const result = await selectLibrary(db, userId);
  if (!hasAccount(result)) throw new LibraryAccountMissingError();
  return fromResult(result);
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

/** What a command leaves: the library as stored, and the title as it was before (what an undo puts back). */
export type AppliedCommand = { state: LibraryState; previous: TitlePreImage };

/** From the offline queue: when the action was done on the device, and the id that makes a resend a no-op. */
export type CommandOptions = { at?: string; commandId?: string };

/**
 * Applies one command for the user and resolves to the library as stored afterwards, with the title's pre-image taken
 * from the state loaded for the command (so the undo a client builds from it never reverts another device's change).
 * The changed rows, the removal markers, the command id and a fresh read of the library go in one transaction, so
 * the answer shows what was really kept (a guarded write may have kept a newer row) and nothing is written when any
 * statement fails.
 *
 * The command is written with the time of the action (`at`, never later than `now`; LibraryStaleError past 30 days),
 * or `now` without one. A restore always uses `now`: its fingerprint guards it, not a time. A `commandId` already
 * applied answers the library as stored, writing nothing, even when a copy of the request races this one.
 */
export async function applyLibraryCommand(
  db: Database,
  userId: string,
  command: LibraryCommand,
  now: string,
  options: CommandOptions = {},
): Promise<AppliedCommand> {
  const time = actionTime(options.at, now);
  const at = command.type === 'restore' ? now : time;
  const { commandId } = options;
  const [before, stored] = await Promise.all([loadAccountLibrary(db, userId), loadRemovals(db, userId, commandId)]);
  const previous = titlePreImage(before, refOfCommand(command));
  if (stored.applied) return { state: before, previous };

  const applied = command.type === 'restore' ? clampRestore(command, now) : command;
  if (applied.type === 'restore') assertExpected(before, applied);
  const after = reduce(before, applied, at);
  assertWithinLimits(before, after);

  const diff = diffStates(before, after);
  const plan = planRemovals(applied, diff, stored.removals);
  if (isEmptyPlan(plan) && !commandId) return { state: isEmptyDiff(diff) ? after : before, previous };
  // A restore re-checks its fingerprint inside the transaction, so a write landing after the load aborts it.
  const guard = applied.type === 'restore' && applied.expected ? { ref: applied.ref, expected: applied.expected } : null;
  try {
    const results = await writeAtomically(db, (q) => [
      ...(guard ? [expectedGuard(q, userId, guard.ref, guard.expected)] : []),
      ...(commandId ? [appliedStatement(q, userId, commandId, now)] : []),
      forgetOldRemovals(q, userId, now),
      forgetOldCommands(q, userId, now),
      ...diffStatements(q, userId, plan.diff, applied.type === 'restore' ? null : at),
      ...removalStatements(q, userId, plan, at),
      selectLibrary(q, userId),
    ]);
    return { state: fromResult(results.at(-1)), previous };
  } catch (error) {
    if (isGuardAbort(error)) throw new LibraryConflictError();
    // Another copy of this command committed first: nothing of this one was written.
    if (isDuplicateCommand(error)) return { state: await loadLibrary(db, userId), previous };
    throw error;
  }
}
