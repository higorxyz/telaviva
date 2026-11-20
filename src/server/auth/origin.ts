/**
 * Same-origin check for state-changing requests (CSRF defense in depth on top of SameSite=Lax cookies).
 *
 * The request's own origin comes from the headers the hosting platform sets: on Vercel `x-forwarded-host` and
 * `x-forwarded-proto` (overwritten on every request), under `next start` / `next dev` the `Host` header and the
 * URL's protocol. A cross-site page can make a browser send a POST, but it cannot choose these headers nor the
 * `Origin` the browser attaches, so comparing the two is enough.
 */

const firstHop = (value: string | null) => value?.split(',')[0]?.trim() || null;

/** `proto://host[:port]` of the request itself, normalized like a browser's Origin; null when it can't be built. */
export function expectedOrigin(request: Request): string | null {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  const host =
    firstHop(request.headers.get('x-forwarded-host')) ??
    firstHop(request.headers.get('host')) ??
    url.host;
  const proto = (
    firstHop(request.headers.get('x-forwarded-proto')) ?? url.protocol.replace(/:$/, '')
  ).toLowerCase();
  if (proto !== 'http' && proto !== 'https') return null;
  try {
    const origin = new URL(`${proto}://${host}`);
    // A host header carrying a path, credentials or a query is not a host.
    if (
      origin.pathname !== '/' ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash
    )
      return null;
    return origin.origin;
  } catch {
    return null;
  }
}

/** True only when `Origin` is present and equals the request's own origin. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const expected = expectedOrigin(request);
  return expected !== null && origin.toLowerCase() === expected;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Cookies get `Secure` everywhere except plain http on localhost / 127.0.0.1 (local dev and E2E). */
export function isSecureRequest(request: Request): boolean {
  const origin = expectedOrigin(request);
  if (!origin) return true;
  const { protocol, hostname } = new URL(origin);
  return !(protocol === 'http:' && LOCAL_HOSTS.has(hostname));
}
