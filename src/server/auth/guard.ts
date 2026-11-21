import 'server-only';
import { NextResponse } from 'next/server';
import { createRateLimiter } from '@/lib/api-guard';
import { serverAuthEnabled } from '@/lib/env';
import { readCookie, SESSION_COOKIE } from './cookies';
import { isSameOrigin } from './origin';
import { readSession, SessionUnavailableError, type SessionUser } from './session';

/**
 * Shared guards for the routes behind sign-in (/api/auth/*, /api/library/*, /api/account/*).
 * With sign-in off (Firebase or database not configured) they answer 404, as if they did not exist.
 */

/** Per-IP budget for minting sessions, separate from the TMDb routes' budget so browsing never blocks sign-in. */
export const authRateLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

/**
 * Per-IP budget for password resets, apart from the sign-in one: asking for resets never blocks signing in, and
 * signing in never uses up the resets. Each reset may send an e-mail, so it is the smaller of the two.
 */
export const resetRateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

/** Per-IP budget for /api/library/*: generous, since marking episodes one by one sends a command per click. */
export const libraryRateLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

/** Per-IP budget for the account export: it reads the whole library, and nobody needs it often. */
export const exportRateLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

/** The uid the page showed when the person acted on their account (DELETE and export of /api/account). */
export const EXPECTED_USER_HEADER = 'x-expected-user';

const SAFE_METHODS = new Set(['GET', 'HEAD']);

export function authRoutesEnabled(): boolean {
  return serverAuthEnabled();
}

/** Every answer of these routes is about one person: never kept by a browser or a shared cache. */
export const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

/** A JSON answer that is never cached. */
export function noStoreJson(body: unknown, init: { status?: number } = {}): NextResponse {
  return NextResponse.json(body, { status: init.status, headers: NO_STORE_HEADERS });
}

/** An empty answer (204 by default) that is never cached. */
export function noStoreEmpty(status = 204): NextResponse {
  return new NextResponse(null, { status, headers: NO_STORE_HEADERS });
}

export function jsonError(error: string, status: number): NextResponse {
  return noStoreJson({ error }, { status });
}

/** 404 when sign-in is off; 403 when a state-changing request lacks a same-origin `Origin`; null to go on. */
export function authGate(request: Request): NextResponse | null {
  if (!authRoutesEnabled()) return jsonError('not_found', 404);
  if (!SAFE_METHODS.has(request.method.toUpperCase()) && !isSameOrigin(request)) {
    return jsonError('forbidden', 403);
  }
  return null;
}

/**
 * The signed-in user, or the response to send instead (404 / 403 / 401 `{ error: 'unauthenticated' }`, or 503
 * `{ error: 'unavailable' }` when the cookie could not be checked right now).
 * Pass `checkRevoked` for sensitive operations: it costs a call to Firebase but rejects revoked sessions and
 * disabled accounts at once.
 */
export async function requireUser(
  request: Request,
  opts: { checkRevoked?: boolean } = {},
): Promise<SessionUser | NextResponse> {
  // Read the request before anything else: under Cache Components this keeps GET handlers out of prerendering
  // even when sign-in is off at build time.
  const cookie = readCookie(request, SESSION_COOKIE);
  const blocked = authGate(request);
  if (blocked) return blocked;
  try {
    const user = await readSession(cookie, { checkRevoked: opts.checkRevoked });
    return user ?? jsonError('unauthenticated', 401);
  } catch (error) {
    if (error instanceof SessionUnavailableError) return jsonError('unavailable', 503);
    throw error;
  }
}

/**
 * Refuses to act on an account other than the one the page showed: another tab may have signed in as someone else,
 * and the cookie (shared by every tab) now names them. 400 without the header, 409 `wrong_account` on a mismatch.
 */
export function expectedUserGate(request: Request, user: SessionUser): NextResponse | null {
  const expected = request.headers.get(EXPECTED_USER_HEADER);
  if (!expected) return jsonError('bad_request', 400);
  return expected === user.id ? null : jsonError('wrong_account', 409);
}
