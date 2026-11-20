import 'server-only';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { serverAuthEnabled } from '@/lib/env';
import { describeError, SetupError } from '@/lib/setup-error';
import { getDb, type Database } from '@/server/db/client';
import { upsertUser } from '@/server/users';
import { getAdminAuth } from './admin';
import { SESSION_MAX_AGE_SECONDS } from './cookies';

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  photoUrl: string | null;
  emailVerified: boolean;
  /** Seconds since the epoch of the last real sign-in (the token's `auth_time`). */
  authTime: number;
};

export const SESSION_DURATION_MS = SESSION_MAX_AGE_SECONDS * 1000;
/** Only a token from a sign-in at most this old can mint a session: a stolen, older token cannot. */
const MAX_SIGN_IN_AGE_SECONDS = 5 * 60;

/** An auth failure the caller answers with 401. Anything else (database, network) is a server error. */
export class SessionError extends Error {
  constructor(readonly code: 'invalid_token' | 'stale_login') {
    super(code);
    this.name = 'SessionError';
  }
}

const str = (value: unknown) => (typeof value === 'string' && value ? value : null);

function toSessionUser(decoded: DecodedIdToken): SessionUser {
  return {
    id: decoded.uid,
    email: str(decoded.email),
    name: str(decoded.name),
    photoUrl: str(decoded.picture),
    emailVerified: decoded.email_verified === true,
    authTime: decoded.auth_time,
  };
}

type Deps = { db?: Database; auth?: Auth };

/**
 * Exchanges a fresh Firebase ID token for a 14-day session cookie and saves the user's profile.
 * The token is checked for revocation (and a disabled account) before anything is created.
 */
export async function createSession(
  idToken: string,
  deps: Deps = {},
): Promise<{ cookie: string; user: SessionUser }> {
  const auth = deps.auth ?? getAdminAuth();
  let decoded: DecodedIdToken;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    throw new SessionError('invalid_token');
  }
  if (Date.now() / 1000 - decoded.auth_time > MAX_SIGN_IN_AGE_SECONDS) {
    throw new SessionError('stale_login');
  }

  const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
  const user = toSessionUser(decoded);
  await upsertUser(deps.db ?? getDb(), user);
  return { cookie, user };
}

/** The user behind a session cookie; null when it is missing, invalid, expired, revoked or sign-in is off. */
export async function readSession(
  cookieValue: string | undefined,
  opts: { checkRevoked?: boolean; auth?: Auth } = {},
): Promise<SessionUser | null> {
  if (!cookieValue || !serverAuthEnabled()) return null;
  try {
    const auth = opts.auth ?? getAdminAuth();
    return toSessionUser(await auth.verifySessionCookie(cookieValue, opts.checkRevoked ?? false));
  } catch (error) {
    // A bad cookie is routine and stays quiet. A setup error means nobody can sign in: say why (its message holds
    // no secrets). The cookie itself is never logged.
    if (error instanceof SetupError) console.error('[auth] could not read the session:', describeError(error));
    return null;
  }
}
