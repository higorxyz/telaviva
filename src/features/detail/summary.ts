const MAX = 155;

/** Truncates on a word boundary to at most `max` characters, ending with an ellipsis. */
export function truncateSummary(text: string, max = MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s.,;:!?-]+$/, '')}…`;
}
