import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mediaKey } from '@/features/catalog/media-key';
import { scoreRecommendations, type Seed } from '@/features/library/recommend';
import { getTrending } from '@/features/tmdb/movies';
import { getRecommendationsFor } from '@/features/tmdb/recommendations';
import type { MediaSummary } from '@/features/tmdb/types';

const MIN_RESULTS = 10;
/** Seeds asked at once, and available titles kept per seed: bounds the provider lookups one request can start. */
const SEED_BATCH = 4;
const RECS_PER_SEED = 10;

const bodySchema = z.object({
  seeds: z
    .array(
      z.object({
        mediaType: z.enum(['movie', 'tv']),
        tmdbId: z.number().int().positive(),
        weight: z.number().finite(),
        genreIds: z.array(z.number()).max(20),
      }),
    )
    .min(1)
    .max(12),
  exclude: z
    .array(z.string().regex(/^(movie|tv):\d+$/))
    .max(500),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Informe de 1 a 12 sementes e até 500 chaves de exclusão.' }, { status: 400 });
  }
  const seeds: Seed[] = parsed.data.seeds;
  const exclude = new Set(parsed.data.exclude);

  const settled: PromiseSettledResult<MediaSummary[]>[] = [];
  for (let start = 0; start < seeds.length; start += SEED_BATCH) {
    const batch = seeds.slice(start, start + SEED_BATCH);
    settled.push(
      ...(await Promise.allSettled(batch.map((s) => getRecommendationsFor(s.mediaType, s.tmdbId, RECS_PER_SEED)))),
    );
  }
  const bySeed = new Map<string, MediaSummary[]>();
  settled.forEach((outcome, i) => {
    const s = seeds[i]!;
    if (outcome.status === 'fulfilled') bySeed.set(`${s.mediaType}:${s.tmdbId}`, outcome.value);
    else console.error(`[api/recommendations] failed for ${s.mediaType} ${s.tmdbId}`, outcome.reason);
  });

  // Both sources are already limited to titles available in Brazil (getRecommendationsFor and getTrending
  // post-filter inside their caches), so the scored candidates and the trending padding need no second pass.
  const results = scoreRecommendations(seeds, bySeed, exclude);

  if (results.length < MIN_RESULTS) {
    try {
      const taken = new Set([...exclude, ...seeds.map((s) => `${s.mediaType}:${s.tmdbId}`), ...results.map(mediaKey)]);
      const trending = await getTrending('all', 'week', 1);
      for (const media of trending.results) {
        if (results.length >= MIN_RESULTS) break;
        const key = mediaKey(media);
        if (taken.has(key)) continue;
        taken.add(key);
        results.push(media);
      }
    } catch (error) {
      console.error('[api/recommendations] trending failed', error);
      if (bySeed.size === 0) {
        return NextResponse.json({ error: 'Não foi possível carregar recomendações agora.' }, { status: 502 });
      }
    }
  }
  return NextResponse.json({ results });
}
