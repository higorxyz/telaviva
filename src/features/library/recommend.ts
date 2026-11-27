import { mediaKey } from '../catalog/media-key';
import type { MediaSummary, MediaType } from '../tmdb/types';
import { itemKey } from './commands';
import type { LibraryItem, LibraryState } from './types';

export type Seed = { mediaType: MediaType; tmdbId: number; weight: number; genreIds: number[] };

export const MAX_POSITIVE_SEEDS = 8;
export const MAX_NEGATIVE_SEEDS = 4;
/** Limits of /api/recommendations (above them it answers 400); the client never sends more. */
export const MAX_SEEDS = MAX_POSITIVE_SEEDS + MAX_NEGATIVE_SEEDS;
export const MAX_EXCLUDE_KEYS = 500;
const MAX_RESULTS = 20;
const FREQUENCY_FACTOR = 5;
const FREQUENCY_CAP = 40;
const GENRE_FACTOR = 3;
const GENRE_CAP = 30;

/** Seed weight: a personal rating wins over the status. */
function weightOfScore(score: number): number {
  if (score >= 8) return 2;
  if (score >= 5) return 1;
  return -1.5;
}

function weightOf(item: LibraryItem, score: number | undefined): number {
  if (score !== undefined) return weightOfScore(score);
  return item.status === 'want' ? 0.5 : 1;
}

/** Up to 8 positive seeds (highest weight, then most recent) and up to 4 negative ones. */
export function pickSeeds(state: LibraryState): Seed[] {
  const scores = new Map(state.ratings.map((r) => [itemKey(r), r.score]));
  const all: { seed: Seed; updatedAt: string }[] = state.items.map((item) => ({
    updatedAt: item.updatedAt,
    seed: {
      mediaType: item.mediaType,
      tmdbId: item.tmdbId,
      weight: weightOf(item, scores.get(itemKey(item))),
      genreIds: item.snapshot.genreIds,
    },
  }));
  // Ratings without an item still carry taste; they have no snapshot, so no genres.
  const itemKeys = new Set(state.items.map(itemKey));
  for (const r of state.ratings) {
    if (itemKeys.has(itemKey(r))) continue;
    all.push({
      updatedAt: r.updatedAt,
      seed: { mediaType: r.mediaType, tmdbId: r.tmdbId, weight: weightOfScore(r.score), genreIds: [] },
    });
  }
  const byRecency = (a: (typeof all)[number], b: (typeof all)[number]) => b.updatedAt.localeCompare(a.updatedAt);
  const positive = all
    .filter((s) => s.seed.weight > 0)
    .sort((a, b) => b.seed.weight - a.seed.weight || byRecency(a, b))
    .slice(0, MAX_POSITIVE_SEEDS);
  const negative = all
    .filter((s) => s.seed.weight < 0)
    .sort((a, b) => a.seed.weight - b.seed.weight || byRecency(a, b))
    .slice(0, MAX_NEGATIVE_SEEDS);
  return [...positive, ...negative].map((s) => s.seed);
}

/**
 * Weighted version of the v1 formula. Candidates only reachable through disliked seeds are dropped,
 * as are excluded keys and the seeds themselves.
 */
export function scoreRecommendations(
  seeds: Seed[],
  bySeed: Map<string, MediaSummary[]>,
  exclude: Set<string>,
): MediaSummary[] {
  const seedKeys = new Set(seeds.map(itemKey));
  const affinity = new Map<number, number>();
  for (const seed of seeds) {
    if (seed.weight <= 0) continue;
    for (const g of new Set(seed.genreIds)) affinity.set(g, (affinity.get(g) ?? 0) + 1);
  }

  const candidates = new Map<string, { media: MediaSummary; positive: number; negative: number }>();
  for (const seed of seeds) {
    const seen = new Set<string>();
    for (const media of bySeed.get(itemKey(seed)) ?? []) {
      const key = mediaKey(media);
      // A list counts once per candidate even if TMDb repeats it.
      if (exclude.has(key) || seedKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      const entry = candidates.get(key) ?? { media, positive: 0, negative: 0 };
      candidates.set(key, entry);
      const points = seed.weight * FREQUENCY_FACTOR;
      if (points > 0) entry.positive += points;
      else entry.negative += points;
    }
  }

  const scored: { media: MediaSummary; score: number }[] = [];
  for (const { media, positive, negative } of candidates.values()) {
    const frequency = Math.min(positive, FREQUENCY_CAP) + negative;
    if (frequency <= 0) continue;
    const genre = Math.min(
      [...new Set(media.genreIds)].reduce((sum, g) => sum + (affinity.get(g) ?? 0) * GENRE_FACTOR, 0),
      GENRE_CAP,
    );
    const vote = (media.voteAverage / 10) * 20;
    const popularity = Math.min((media.popularity / 100) * 10, 10);
    scored.push({ media, score: frequency + genre + vote + popularity });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((s) => s.media);
}
