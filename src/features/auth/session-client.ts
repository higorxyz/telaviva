import { z } from 'zod';
import { requestDeadline } from '@/lib/request-timeout';

/** The signed-in user as `/api/auth/me` and `POST /api/auth/session` answer it (src/server/auth/session.ts). */
export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  photoUrl: string | null;
  emailVerified: boolean;
  authTime: number;
  /** How the sign-in behind the session was made: what signing in again (to delete the account) must use. */
  provider: 'google' | 'password' | null;
};

/** A `SessionUser` as the server sends it (and as offline-identity.ts keeps it on the device). */
export const sessionUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().nullable(),
  name: z.string().nullable(),
  photoUrl: z.string().nullable(),
  emailVerified: z.boolean(),
  authTime: z.number(),
  provider: z.enum(['google', 'password']).nullable().catch(null),
});

const userBody = z.object({ user: sessionUserSchema });

/** Public hint cookie: only tells the client to try the signed-in mode. Never trusted for anything. */
const HINT = 'tv_auth';

export function hasAuthHint(): boolean {
  return document.cookie.split(';').some((part) => part.trim() === `${HINT}=1`);
}

/** Drops the hint locally, so a dead session is not retried on every page load. */
export function clearAuthHint(): void {
  document.cookie = `${HINT}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/** A session request the server refused (`status`) or that never reached it (`status` null). */
export class SessionRequestError extends Error {
  constructor(readonly status: number | null) {
    super(status === null ? 'Could not reach the session service' : `The session service answered ${status}`);
    this.name = 'SessionRequestError';
  }
}

const init: RequestInit = { credentials: 'same-origin', cache: 'no-store' };

async function readUser(response: Response): Promise<SessionUser> {
  const parsed = userBody.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new SessionRequestError(response.status);
  return parsed.data.user;
}

export type MeResult =
  | { kind: 'user'; user: SessionUser }
  | { kind: 'unauthenticated' }
  /** Sign-in is off on the server (404). */
  | { kind: 'off' }
  /**
   * No usable answer: no connection, a 5xx, a body that is not a user. `timeout`: nothing came back within
   * REQUEST_TIMEOUT_MS (a connection with signal but no data), so asking again right away would not help.
   */
  | { kind: 'error'; reason?: 'timeout' };

/** `/api/auth/me`, given up on after REQUEST_TIMEOUT_MS (src/lib/request-timeout.ts), body included. */
export async function fetchMe(): Promise<MeResult> {
  const deadline = requestDeadline();
  const error = (): MeResult => (deadline.expired ? { kind: 'error', reason: 'timeout' } : { kind: 'error' });
  try {
    let response: Response;
    try {
      response = await fetch('/api/auth/me', { ...init, signal: deadline.signal });
    } catch {
      return error();
    }
    if (response.status === 401) return { kind: 'unauthenticated' };
    if (response.status === 404) return { kind: 'off' };
    if (!response.ok) return error();
    try {
      return { kind: 'user', user: await readUser(response) };
    } catch {
      return error();
    }
  } finally {
    deadline.clear();
  }
}

/** Exchanges a fresh ID token for the session cookies; resolves to the user the server now knows. */
export async function createSession(idToken: string): Promise<SessionUser> {
  let response: Response;
  try {
    response = await fetch('/api/auth/session', {
      ...init,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    throw new SessionRequestError(null);
  }
  if (!response.ok) throw new SessionRequestError(response.status);
  return readUser(response);
}

/**
 * Ends the session on the server (it clears both cookies). Never throws; true when the server answered that it did
 * (or, with a 404, that sign-in is off and there is no session to end), false when the request failed (offline, or no
 * answer in time) or was refused, so the httpOnly cookie may still be there.
 */
export async function deleteSession(): Promise<boolean> {
  // Given up on after REQUEST_TIMEOUT_MS like `fetchMe`: a hung DELETE would hold "Sair" and the next start-up.
  const deadline = requestDeadline();
  try {
    const response = await fetch('/api/auth/session', { ...init, method: 'DELETE', signal: deadline.signal });
    return response.ok || response.status === 404;
  } catch {
    return false;
  } finally {
    deadline.clear();
  }
}
