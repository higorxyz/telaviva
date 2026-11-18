export const MIN_QUERY = 2;
export const MAX_QUERY = 100;

/** Trims and collapses whitespace; null when shorter than 2 or longer than 100 chars. */
export function normalizeQuery(q: string | null | undefined): string | null {
  if (q == null) return null;
  const normalized = q.trim().replace(/\s+/g, ' ');
  if (normalized.length < MIN_QUERY || normalized.length > MAX_QUERY) return null;
  return normalized;
}
