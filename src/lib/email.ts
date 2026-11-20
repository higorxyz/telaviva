const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A loose shape check (something@domain.tld, at most 254 characters): Firebase has the final word. */
export function looksLikeEmail(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value);
}
