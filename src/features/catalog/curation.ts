import type { RawContentRatings, RawReleaseDates } from '@/features/tmdb/detail-schemas';
import type { MediaSummary, Video } from '@/features/tmdb/types';

// Pure curation rules ported from v1. No I/O.

/** Bayesian average: pulls ratings with few votes toward the global mean `c`. */
export function weightedRating(vote: number, count: number, m = 1500, c = 6.8): number {
  return (count / (count + m)) * vote + (m / (count + m)) * c;
}

export function sortByWeightedRating(items: MediaSummary[], m?: number): MediaSummary[] {
  const score = (i: MediaSummary) => weightedRating(i.voteAverage, i.voteCount, m);
  return [...items].sort((a, b) => score(b) - score(a));
}

export interface RefineRules {
  minVoteAverage?: number;
  minVoteCount?: number;
  requireImage?: boolean;
  minOverviewLength?: number;
  minDate?: Date;
  maxDate?: Date;
  /** Se o resultado filtrado tiver menos itens que isto, devolve a lista original. Padrão 8. */
  minResultsBeforeFallback?: number;
}

function passes(item: MediaSummary, rules: RefineRules): boolean {
  if (rules.minVoteAverage !== undefined && item.voteAverage < rules.minVoteAverage) return false;
  if (rules.minVoteCount !== undefined && item.voteCount < rules.minVoteCount) return false;
  if (rules.requireImage && !item.posterPath) return false;
  if (rules.minOverviewLength !== undefined && item.overview.trim().length < rules.minOverviewLength) {
    return false;
  }
  if (rules.minDate || rules.maxDate) {
    if (!item.releaseDate) return false;
    const time = new Date(item.releaseDate).getTime();
    if (Number.isNaN(time)) return false;
    if (rules.minDate && time < rules.minDate.getTime()) return false;
    if (rules.maxDate && time > rules.maxDate.getTime()) return false;
  }
  return true;
}

export function refine(items: MediaSummary[], rules: RefineRules): MediaSummary[] {
  const refined = items.filter((item) => passes(item, rules));
  return refined.length < (rules.minResultsBeforeFallback ?? 8) ? items : refined;
}

/** YouTube +50, Trailer +30, oficial +15, pt +10. Só YouTube é aceito. */
export function pickTrailer(videos: Video[]): Video | null {
  let best: Video | null = null;
  let bestScore = -1;
  for (const v of videos) {
    if (v.site !== 'YouTube') continue;
    const score =
      50 + (v.type === 'Trailer' ? 30 : 0) + (v.official ? 15 : 0) + (v.language === 'pt' ? 10 : 0);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

const THEATRICAL = 3;

export function brCertification(releaseDates: RawReleaseDates): string | null {
  const br = releaseDates.results.find((r) => r.iso_3166_1 === 'BR');
  if (!br) return null;
  const filled = br.release_dates.filter((d) => d.certification.trim() !== '');
  const preferred = filled.find((d) => d.type === THEATRICAL) ?? filled[0];
  return preferred ? preferred.certification.trim() : null;
}

export function brTvRating(contentRatings: RawContentRatings): string | null {
  const rating = contentRatings.results.find((r) => r.iso_3166_1 === 'BR')?.rating.trim();
  return rating || null;
}
