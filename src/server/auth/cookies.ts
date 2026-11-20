import { isSecureRequest } from './origin';

/** httpOnly Firebase session cookie: the only thing the server trusts. */
export const SESSION_COOKIE = 'tv_session';
/** Public hint (`1`) so the client knows to load the signed-in mode. Never used for authorization. */
export const AUTH_HINT_COOKIE = 'tv_auth';
/** 14 days, the longest session cookie Firebase issues. */
export const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

/** Firebase session cookies are JWTs; anything else is refused rather than written into a header. */
const COOKIE_VALUE = /^[A-Za-z0-9._-]+$/;

function serialize(
  request: Request,
  name: string,
  value: string,
  opts: { maxAge: number; httpOnly: boolean },
) {
  const parts = [`${name}=${value}`, 'Path=/', `Max-Age=${opts.maxAge}`];
  if (opts.httpOnly) parts.push('HttpOnly');
  parts.push('SameSite=Lax');
  if (isSecureRequest(request)) parts.push('Secure');
  return parts.join('; ');
}

/** The two `Set-Cookie` values for a new session. */
export function sessionCookies(request: Request, sessionCookie: string): string[] {
  if (!COOKIE_VALUE.test(sessionCookie)) {
    throw new Error('Session cookie with unexpected characters.');
  }
  const opts = { maxAge: SESSION_MAX_AGE_SECONDS };
  return [
    serialize(request, SESSION_COOKIE, sessionCookie, { ...opts, httpOnly: true }),
    serialize(request, AUTH_HINT_COOKIE, '1', { ...opts, httpOnly: false }),
  ];
}

/** The two `Set-Cookie` values that expire both cookies. */
export function clearedCookies(request: Request): string[] {
  return [
    serialize(request, SESSION_COOKIE, '', { maxAge: 0, httpOnly: true }),
    serialize(request, AUTH_HINT_COOKIE, '', { maxAge: 0, httpOnly: false }),
  ];
}

/** First value of the named cookie in the request's `Cookie` header. */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || undefined;
  }
  return undefined;
}

export function withCookies(response: Response, cookies: string[]): Response {
  for (const cookie of cookies) response.headers.append('Set-Cookie', cookie);
  return response;
}
