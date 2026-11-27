import { limitByIp } from '@/lib/api-guard';
import { describeError } from '@/lib/setup-error';
import { AccountAuthError, deleteAccount } from '@/server/account';
import { getAdminAuth } from '@/server/auth/admin';
import { clearedCookies, withCookies } from '@/server/auth/cookies';
import { authRateLimiter, expectedUserGate, jsonError, noStoreEmpty, requireUser } from '@/server/auth/guard';
import { isRecentSignIn } from '@/server/auth/session';
import { getDb } from '@/server/db/client';


/**
 * Deletes the signed-in user's account and all of its data (LGPD). The session is checked for revocation, and the
 * sign-in behind it must be at most 5 minutes old (`authTime` comes from the verified cookie, and a renewed session
 * keeps the original sign-in time): otherwise 401 `{ error: 'reauth' }` and the client signs in again. Before that, the
 * `X-Expected-User` header must name the session's user (409 otherwise), so a stale tab never deletes someone else.
 */
export async function DELETE(request: Request) {
  const user = await requireUser(request, { checkRevoked: true });
  if (user instanceof Response) return user;
  const blocked = limitByIp(request, authRateLimiter) ?? expectedUserGate(request, user);
  if (blocked) return blocked;
  if (!isRecentSignIn(user.authTime)) return jsonError('reauth', 401);

  try {
    await deleteAccount(await getDb(), getAdminAuth(), user.id);
  } catch (error) {
    // The data is gone when Firebase fails: 502, and a retry finishes the job.
    const firebase = error instanceof AccountAuthError;
    const cause = firebase ? error.cause : error;
    console.error(`[api/account] could not delete the account (${firebase ? 'firebase' : 'database'}):`, describeError(cause));
    return jsonError('server_error', firebase ? 502 : 500);
  }
  return withCookies(noStoreEmpty(), clearedCookies(request));
}
