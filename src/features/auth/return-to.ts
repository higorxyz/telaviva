/** Where a fresh sign-in lands without a `?voltar=`. */
export const AFTER_SIGN_IN = '/minha-lista';
/** Where someone who opens /entrar already signed in lands without a `?voltar=`. */
export const ALREADY_SIGNED_IN = '/conta';

const BASE = 'https://telaviva.invalid';

/** A single leading `/`: `//host` and `/\host` are protocol-relative to browsers. */
const singleSlash = (path: string) => path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');

function sameOriginPath(path: string): URL | null {
  try {
    const url = new URL(path, BASE);
    return url.origin === BASE ? url : null;
  } catch {
    return null;
  }
}

/**
 * The `?voltar=` destination when it is a path on this site, else `fallback`.
 *
 * The checks run on the input AND on the output. The URL parser collapses dot segments and strips tabs and newlines,
 * so an input that passes (`/.//evil.com`, `/%2e%2e//evil.com`) can come out as `//evil.com`, which the router
 * would follow off the site. The result must itself start with a single `/` and resolve to this origin.
 * /entrar itself is refused, so a signed-in visitor never loops back here.
 */
export function safeReturnTo(raw: string | null | undefined, fallback: string): string {
  if (!raw || !singleSlash(raw)) return fallback;
  const url = sameOriginPath(raw);
  if (!url) return fallback;
  if (url.pathname === '/entrar' || url.pathname.startsWith('/entrar/')) return fallback;
  const result = `${url.pathname}${url.search}${url.hash}`;
  if (!singleSlash(result) || sameOriginPath(result)?.href !== url.href) return fallback;
  return result;
}
