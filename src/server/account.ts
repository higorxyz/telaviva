import 'server-only';
import { eq } from 'drizzle-orm';
import type { Auth } from 'firebase-admin/auth';
import type { LibraryState } from '@/features/library/types';
import type { Database } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { writeAtomically } from '@/server/library/atomic';
import { toIso } from '@/server/library/rows';
import { loadLibrary } from '@/server/library/store';
import type { UserProfile } from '@/server/users';

/** Firebase refused to delete the user after the database was already cleared: the route answers 502. */
export class AccountAuthError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Could not delete the Firebase user', options);
    this.name = 'AccountAuthError';
  }
}

const codeOf = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : null;

/**
 * Deletes the account (plan, Foco 4). The data goes first, in one transaction: the `users` row, whose foreign keys
 * cascade to every library row. Only then is the Firebase user deleted. So a failure in the middle leaves at most a
 * Firebase user without data, never data without an account, and repeating the whole thing is safe: the database
 * step finds nothing, and a Firebase user that is already gone counts as deleted.
 */
export async function deleteAccount(
  db: Database,
  adminAuth: Pick<Auth, 'deleteUser'>,
  userId: string,
): Promise<void> {
  await writeAtomically(db, (q) => [q.delete(users).where(eq(users.id, userId))]);
  try {
    await adminAuth.deleteUser(userId);
  } catch (error) {
    if (codeOf(error) === 'auth/user-not-found') return;
    throw new AccountAuthError({ cause: error });
  }
}

export type AccountExport = {
  exportedAt: string;
  user: UserProfile & { createdAt: string | null };
  library: LibraryState;
};

/**
 * Everything kept about the user (LGPD): the stored profile and the whole library. Without a stored profile (a
 * deletion that stopped half way) the session's profile stands in, with no creation date.
 */
export async function exportAccount(db: Database, session: UserProfile, now: Date): Promise<AccountExport> {
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, photoUrl: users.photoUrl, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, session.id));
  const library = await loadLibrary(db, session.id);
  const { id, email, name, photoUrl } = row ?? session;
  const createdAt = row ? toIso(row.createdAt) : null;
  return {
    exportedAt: now.toISOString(),
    user: { id, email, name, photoUrl, createdAt: typeof createdAt === 'string' ? createdAt : null },
    library,
  };
}

const SAO_PAULO_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `telaviva-meus-dados-AAAA-MM-DD.json`, dated in the São Paulo calendar. */
export function exportFilename(now: Date): string {
  const part = (type: string) => SAO_PAULO_DAY.formatToParts(now).find((p) => p.type === type)?.value;
  return `telaviva-meus-dados-${part('year')}-${part('month')}-${part('day')}.json`;
}
