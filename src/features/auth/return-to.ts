/** Where a fresh sign-in lands without a `?voltar=`. */
export const AFTER_SIGN_IN = '/minha-lista';
/** Where someone who opens /entrar already signed in lands without a `?voltar=`. */
export const ALREADY_SIGNED_IN = '/conta';

const BASE = 'https://telaviva.invalid';

/**
 * The `?voltar=` destination when it is a path on this site, else `fallback`.
 *
 * Only a single leading `/` is accepted: `//host` and `/\host` are protocol-relative to browsers. The value is also
 * resolved against a fixed origin, which catches what browsers strip or rewrite (tabs, newlines, backslashes): the
 * result must stay on that origin. /entrar itself is refused, so a signed-in visitor never loops back here.
 */
export function safeReturnTo(raw: string | null | undefined, fallback: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  if (url.pathname === '/entrar' || url.pathname.startsWith('/entrar/')) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
