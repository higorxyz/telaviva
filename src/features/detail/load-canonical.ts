import { notFound } from 'next/navigation';
import { isTmdbNotFound } from '@/features/tmdb/client';
import { assertCanonical, resolveCanonical, type CanonicalKind } from './canonical';

/** Loads a title by the id in its slug: 404 for bad ids and TMDb 404s, other errors propagate. */
export async function loadByIdSlug<T>(
  slug: string,
  kind: CanonicalKind,
  load: (id: number) => Promise<T>,
): Promise<T> {
  const resolved = resolveCanonical({ slug }, kind);
  if (resolved === 'not-found') notFound();
  try {
    return await load(resolved.id);
  } catch (error) {
    if (isTmdbNotFound(error)) notFound();
    throw error;
  }
}

/**
 * Shared page flow for /filme, /serie and /pessoa: load, then 308 to the canonical URL when the slug differs.
 * Call it with `params` awaited at the top of the page, outside Suspense,
 * so redirects and 404s happen before streaming starts and produce real HTTP status codes.
 * `searchParams` is deliberately NOT read: awaiting it (even only in the redirect branch) makes the route
 * stream after the shell, which turns the 308 into a 200 with a meta refresh,
 * so the query string is dropped on redirect.
 */
export async function loadCanonicalPage<T>(args: {
  params: Promise<{ slug: string }>;
  kind: CanonicalKind;
  load: (id: number) => Promise<T>;
  hrefOf: (item: T) => string;
}): Promise<T> {
  const { slug } = await args.params;
  const item = await loadByIdSlug(slug, args.kind, args.load);
  const canonical = args.hrefOf(item);
  assertCanonical(slug, canonical);
  return item;
}
