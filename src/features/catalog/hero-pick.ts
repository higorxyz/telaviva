import type { MediaSummary } from '@/features/tmdb/types';
import { mediaKey } from './media-key';

const YEAR_MS = 365.25 * 86_400_000;
const PER_SOURCE = 18;


function recencyBonus(releaseDate: string | null, now: number): number {
  const t = releaseDate ? Date.parse(releaseDate) : NaN;
  if (Number.isNaN(t)) return 0;
  const age = (now - t) / YEAR_MS;
  if (age <= 1.5) return 8;
  if (age <= 5) return 5;
  if (age <= 12) return 2;
  if (age >= 30) return -4;
  return 0;
}

function overviewBonus(overview: string): number {
  const len = overview.trim().length;
  if (len >= 140) return 6;
  if (len >= 90) return 3;
  if (len >= 50) return 0;
  return -8;
}

/**
 * Port of the v1 hero score. `sourceBoost` and `rankBonus` are summed across every source that
 * lists the title; rankBonus is the sum of max(rankBoost - index, 0).
 */
export function scoreHeroCandidate(c: {
  item: MediaSummary;
  sourceBoost: number;
  rankBonus: number;
  sourceCount: number;
  now?: number;
}): number {
  const { item } = c;
  const quality = Math.max(item.voteAverage - 6, 0) * 9;
  const confidence = Math.log10(item.voteCount + 1) * 8;
  const popularity = Math.min(item.popularity, 180) / 10;
  return (
    c.sourceBoost +
    c.rankBonus +
    quality +
    confidence +
    popularity +
    recencyBonus(item.releaseDate, c.now ?? Date.now()) +
    overviewBonus(item.overview) +
    (c.sourceCount - 1) * 5
  );
}

export function pickHero(
  sources: Array<{ items: MediaSummary[]; sourceBoost: number; rankBoost: number }>,
  now: number = Date.now(),
): MediaSummary | null {
  const found = new Map<string, { item: MediaSummary; boost: number; rankBonus: number; count: number }>();
  for (const { items, sourceBoost, rankBoost } of sources) {
    items.slice(0, PER_SOURCE).forEach((item, index) => {
      if (!item.backdropPath) return;
      const key = mediaKey(item);
      const rankBonus = Math.max(rankBoost - index, 0);
      const prev = found.get(key);
      if (!prev) found.set(key, { item, boost: sourceBoost, rankBonus, count: 1 });
      else {
        prev.count += 1;
        prev.boost += sourceBoost;
        prev.rankBonus += rankBonus;
      }
    });
  }
  let best: MediaSummary | null = null;
  let bestScore = -Infinity;
  for (const c of found.values()) {
    const score = scoreHeroCandidate({
      item: c.item,
      sourceBoost: c.boost,
      rankBonus: c.rankBonus,
      sourceCount: c.count,
      now,
    });
    if (score > bestScore) {
      best = c.item;
      bestScore = score;
    }
  }
  return best;
}
