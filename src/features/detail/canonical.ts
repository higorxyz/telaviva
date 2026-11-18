import { permanentRedirect } from 'next/navigation';
import { parseIdFromSlug } from '@/lib/slug';

export type CanonicalKind = 'filme' | 'serie' | 'pessoa';

/** Every kind shares the `${id}-${slug}` format; `kind` documents the caller and keeps room for per-kind rules. */
export function resolveCanonical(
  params: { slug: string },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the per-kind contract
  _kind: CanonicalKind,
): { id: number } | 'not-found' {
  const id = parseIdFromSlug(params.slug);
  return id === null ? 'not-found' : { id };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isCanonical(currentSlug: string, canonicalHref: string): boolean {
  const canonicalSlug = canonicalHref.slice(canonicalHref.lastIndexOf('/') + 1);
  return safeDecode(currentSlug) === canonicalSlug;
}

/** Serializes Next's searchParams into a leading-"?" string ('' when empty). */
export function toSearchString(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const v of values) query.append(key, v);
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

/** Redirects (308) to the canonical URL, keeping the query string, when the slug is not the canonical one. */
export function assertCanonical(currentSlug: string, canonicalHref: string, search = ''): void {
  if (!isCanonical(currentSlug, canonicalHref)) permanentRedirect(`${canonicalHref}${search}`);
}
