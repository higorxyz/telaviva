import { NextResponse } from 'next/server';
import { limitByIp, readJsonBody } from '@/lib/api-guard';
import { describeError } from '@/lib/setup-error';
import {
  clearedCookies,
  readCookie,
  SESSION_COOKIE,
  sessionCookies,
  withCookies,
} from '@/server/auth/cookies';
import { getAdminAuth } from '@/server/auth/admin';
import { authGate, authRateLimiter, jsonError } from '@/server/auth/guard';
import { createSession, readSession, SessionError } from '@/server/auth/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

function readIdToken(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { idToken } = value as { idToken?: unknown };
  return typeof idToken === 'string' && idToken.length > 0 ? idToken : null;
}

/** Exchanges a fresh Firebase ID token for the httpOnly session cookie. */
export async function POST(request: Request) {
  const blocked = authGate(request) ?? limitByIp(request, authRateLimiter);
  if (blocked) return blocked;

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonError(body.status === 413 ? 'payload_too_large' : 'bad_request', body.status);
  }
  const idToken = readIdToken(body.value);
  if (!idToken) return jsonError('bad_request', 400);

  try {
    const { cookie, user } = await createSession(idToken);
    return withCookies(
      NextResponse.json({ user }, { headers: NO_STORE }),
      sessionCookies(request, cookie),
    );
  } catch (error) {
    if (error instanceof SessionError) return jsonError(error.code, 401);
    console.error('[api/auth/session] could not create the session:', describeError(error));
    return jsonError('server_error', 500);
  }
}

/** Signs out: revokes the user's refresh tokens when the session is valid, and always clears both cookies. */
export async function DELETE(request: Request) {
  const blocked = authGate(request);
  if (blocked) return blocked;

  const user = await readSession(readCookie(request, SESSION_COOKIE));
  if (user) {
    try {
      await getAdminAuth().revokeRefreshTokens(user.id);
    } catch (error) {
      console.error('[api/auth/session] could not revoke refresh tokens:', describeError(error));
    }
  }
  return withCookies(
    new NextResponse(null, { status: 204, headers: NO_STORE }),
    clearedCookies(request),
  );
}
