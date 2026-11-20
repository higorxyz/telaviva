import 'server-only';
import { eq } from 'drizzle-orm';
import type { NextResponse } from 'next/server';
import { describeError } from '@/lib/setup-error';
import { getDb } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { jsonError, requireUser } from './guard';
import type { SessionUser } from './session';

/**
 * `requireUser` for the library routes, which also need the user's row. A session cookie outlives an account deleted
 * on another device (it is checked without revocation here, to save a call to Firebase per click): without the row
 * it answers 401 `unauthenticated`, so that device renews the session, and on failing, falls back to the visitor,
 * instead of failing every write on the foreign key.
 */
export async function requireAccount(request: Request): Promise<SessionUser | NextResponse> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  try {
    const [row] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, user.id)).limit(1);
    return row ? user : jsonError('unauthenticated', 401);
  } catch (error) {
    console.error('[auth] could not read the account:', describeError(error));
    return jsonError('server_error', 500);
  }
}
