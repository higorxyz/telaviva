import { limitByIp, readJsonBody } from '@/lib/api-guard';
import { describeError } from '@/lib/setup-error';
import { clearedCookies, sessionCookies, withCookies } from '@/server/auth/cookies';
import { authGate, authRateLimiter, jsonError, noStoreEmpty, noStoreJson } from '@/server/auth/guard';
import { createSession, SessionError, SessionUnavailableError } from '@/server/auth/session';


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
      noStoreJson({ user }),
      sessionCookies(request, cookie),
    );
  } catch (error) {
    if (error instanceof SessionError) return jsonError(error.code, 401);
    if (error instanceof SessionUnavailableError) return jsonError('unavailable', 503);
    console.error('[api/auth/session] could not create the session:', describeError(error));
    return jsonError('server_error', 500);
  }
}

/**
 * Signs out THIS device: clears both cookies (the client signs Firebase out on its side). The user's refresh tokens
 * are deliberately not revoked: revoking ends the sessions of every device at once, and people expect "Sair" on the
 * phone to leave the computer signed in. Only deleting the account ends them all (Firebase's `deleteUser` invalidates
 * every token of the user).
 */
export async function DELETE(request: Request) {
  const blocked = authGate(request);
  if (blocked) return blocked;
  return withCookies(noStoreEmpty(), clearedCookies(request));
}
