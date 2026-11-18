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

/** Redirects (308) to the canonical URL when the requested slug is not the canonical one. */
export function assertCanonical(currentSlug: string, canonicalHref: string): void {
  const canonicalSlug = canonicalHref.slice(canonicalHref.lastIndexOf('/') + 1);
  if (safeDecode(currentSlug) !== canonicalSlug) permanentRedirect(canonicalHref);
}
