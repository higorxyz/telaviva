import { z } from 'zod';

/** The signed-in user as `/api/auth/me` and `POST /api/auth/session` answer it (src/server/auth/session.ts). */
export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  photoUrl: string | null;
  emailVerified: boolean;
  authTime: number;
};

const userBody = z.object({
  user: z.object({
    id: z.string().min(1),
    email: z.string().nullable(),
    name: z.string().nullable(),
    photoUrl: z.string().nullable(),
    emailVerified: z.boolean(),
    authTime: z.number(),
  }),
});

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
  | { kind: 'error' };

export async function fetchMe(): Promise<MeResult> {
  let response: Response;
  try {
    response = await fetch('/api/auth/me', init);
  } catch {
    return { kind: 'error' };
  }
  if (response.status === 401) return { kind: 'unauthenticated' };
  if (response.status === 404) return { kind: 'off' };
  if (!response.ok) return { kind: 'error' };
  try {
    return { kind: 'user', user: await readUser(response) };
  } catch {
    return { kind: 'error' };
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

/** Ends the session on the server (it clears both cookies). Best effort: never throws. */
export async function deleteSession(): Promise<void> {
  try {
    await fetch('/api/auth/session', { ...init, method: 'DELETE' });
  } catch {
    // Offline: the hint is cleared locally and the cookie expires on its own.
  }
}
