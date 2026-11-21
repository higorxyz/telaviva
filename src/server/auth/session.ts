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
  /** How that sign-in was made (the token's `firebase.sign_in_provider`): what signing in again must use. */
  provider: SignInProvider | null;
};

export type SignInProvider = 'google' | 'password';

const PROVIDERS: Readonly<Record<string, SignInProvider>> = { 'google.com': 'google', password: 'password' };

export const SESSION_DURATION_MS = SESSION_MAX_AGE_SECONDS * 1000;
/** How fresh a token must be to mint a session, and how recent a sign-in must be to delete the account. */
const RECENT_SECONDS = 5 * 60;
/** Allowance for our clock lagging or leading Firebase's when judging a token's age. */
const CLOCK_SKEW_SECONDS = 60;

/**
 * A session may be minted from a token whose sign-in (`auth_time`) is recent, or whose minting (`iat`) is: the client
 * renews a lost or expired session in silence with `getIdToken(true)`, which mints a new token but keeps the original
 * `auth_time`. An old leaked token fails on both ages, and `verifyIdToken(token, true)` rejects the tokens of a deleted
 * or disabled account. (Signing out ends one device and revokes nothing: that device's Firebase client signs out
 * too, so it holds no token to renew with.) The new cookie carries the original `auth_time`, so a renewed session
 * never counts as a recent sign-in (`isRecentSignIn`).
 */
function isFreshToken(decoded: DecodedIdToken, nowSeconds: number): boolean {
  const limit = RECENT_SECONDS + CLOCK_SKEW_SECONDS;
  return nowSeconds - decoded.auth_time <= limit || nowSeconds - decoded.iat <= limit;
}

/** True when the real sign-in behind a session (its `authTime`) is at most 5 minutes old: required to delete the account. */
export function isRecentSignIn(authTime: number, nowSeconds = Date.now() / 1000): boolean {
  return nowSeconds - authTime <= RECENT_SECONDS;
}

/** An auth failure the caller answers with 401. Anything else (database, network) is a server error. */
export class SessionError extends Error {
  constructor(readonly code: 'invalid_token' | 'stale_login') {
    super(code);
    this.name = 'SessionError';
  }
}

/**
 * The token or cookie could not be checked at all (Google's public keys or Firebase out of reach): the caller answers
 * 503, which the client treats as passing. Answering 401 would sign a perfectly good session out.
 */
export class SessionUnavailableError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Could not check the session right now', options);
    this.name = 'SessionUnavailableError';
  }
}

/** firebase-admin's answers about the token itself: bad, expired, revoked, or its user disabled or gone. */
const REFUSALS = new Set([
  'auth/argument-error',
  'auth/invalid-argument',
  'auth/invalid-id-token',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/session-cookie-expired',
  'auth/session-cookie-revoked',
  'auth/user-disabled',
  'auth/user-not-found',
]);

/**
 * True when firebase-admin refused the token. A failed download of the public keys is reported as
 * `auth/argument-error` too, but its message says so ("Error fetching ..."): that one, like a network or internal
 * error, says nothing about the token.
 */
function isRefusal(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && REFUSALS.has(code) && !error.message.startsWith('Error fetching');
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
    provider: PROVIDERS[str(decoded.firebase?.sign_in_provider) ?? ''] ?? null,
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
  } catch (error) {
    if (isRefusal(error)) throw new SessionError('invalid_token');
    console.error('[auth] could not check the ID token:', describeError(error));
    throw new SessionUnavailableError({ cause: error });
  }
  if (!isFreshToken(decoded, Date.now() / 1000)) {
    throw new SessionError('stale_login');
  }

  const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
  const user = toSessionUser(decoded);
  await upsertUser(deps.db ?? (await getDb()), user);
  return { cookie, user };
}

/**
 * The user behind a session cookie; null when it is missing, invalid, expired, revoked or sign-in is off. Throws
 * SessionUnavailableError when the cookie could not be checked at all (see `isRefusal`).
 */
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
    if (isRefusal(error)) return null;
    console.error('[auth] could not read the session:', describeError(error));
    if (error instanceof SetupError) return null;
    throw new SessionUnavailableError({ cause: error });
  }
}
