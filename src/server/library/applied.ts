import 'server-only';
import { and, eq, lt } from 'drizzle-orm';
import type { Database } from '@/server/db/client';
import { appliedCommands } from '@/server/db/schema';
import type { Statement } from './atomic';
import { MAX_ACTION_AGE_MS } from './clamp';

/**
 * Deduplication of the offline queue's commands: each carries an id (`commandId`), recorded in `applied_commands` in
 * the same transaction as its writes. A resend finds it (see `loadRemovals`) and writes nothing; a copy racing the
 * first one fails on the primary key, which rolls its whole batch back. Ids are kept 30 days, as long as an action
 * may wait in the queue.
 */

const PRIMARY_KEY = 'applied_commands_pkey';

/** Records the command as applied; in the same batch as its writes, so a copy racing it fails on the key. */
export function appliedStatement(q: Database, userId: string, commandId: string, now: string): Statement {
  return q.insert(appliedCommands).values({ userId, commandId, appliedAt: now });
}

/** Opportunistic cleanup, in every write of the user: the ids past 30 days. */
export function forgetOldCommands(q: Database, userId: string, now: string): Statement {
  const cutoff = new Date(Date.parse(now) - MAX_ACTION_AGE_MS).toISOString();
  return q.delete(appliedCommands).where(and(eq(appliedCommands.userId, userId), lt(appliedCommands.appliedAt, cutoff)));
}

/** True when `error` (or its cause, as drizzle wraps driver errors) is a second copy of an applied command. */
export function isDuplicateCommand(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e instanceof Error && depth < 5; e = e.cause, depth++) {
    const { code, constraint } = e as Error & { code?: unknown; constraint?: unknown };
    if (code === '23505' && (constraint === PRIMARY_KEY || e.message.includes(PRIMARY_KEY))) return true;
  }
  return false;
}
