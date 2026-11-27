import 'server-only';
import type { NextResponse } from 'next/server';
import { expectedUserGate, libraryRateLimiter, requireUser } from './guard';
import type { SessionUser } from './session';

/**
 * `requireUser` for the library routes, in the order that costs least: the per-IP limiter first, then the session,
 * then the `X-Expected-User` header (409 `wrong_account` when another tab switched accounts and the shared cookie now
 * names someone else; 400 without it).
 *
 * The user's row is not read here: the store reads it in the same statement as the library (one round trip) and
 * throws LibraryAccountMissingError when it is gone, which the routes answer with 401 `unauthenticated`. A session
 * cookie outlives an account deleted on another device (it is checked without revocation here, to save a call to
 * Firebase per click); that device then renews the session and, failing, falls back to the visitor.
 */
export async function requireAccount(request: Request): Promise<SessionUser | NextResponse> {
  const user = await requireUser(request, { limiter: libraryRateLimiter });
  if (user instanceof Response) return user;
  return expectedUserGate(request, user) ?? user;
}
