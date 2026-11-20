import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mediaKey } from '@/features/catalog/media-key';
import { MAX_EXCLUDE_KEYS, MAX_SEEDS, scoreRecommendations, type Seed } from '@/features/library/recommend';
import { getTrending } from '@/features/tmdb/movies';
import { getRecommendationsFor } from '@/features/tmdb/recommendations';
import type { MediaSummary } from '@/features/tmdb/types';
import { limitByIp, readJsonBody } from '@/lib/api-guard';

const MIN_RESULTS = 10;
/** Seeds asked at once, and available titles kept per seed: bounds the provider lookups one request can start. */
const SEED_BATCH = 4;
const RECS_PER_SEED = 10;
/**
 * Provider lookups the seeds of one request may ask for, split evenly (a recommendations page has 20 titles). The
 * trending padding is not counted: it is one entry shared by every visitor, screened once per cache lifetime.
 */
const MAX_LOOKUPS = 120;
const RECS_PAGE_SIZE = 20;

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
    .max(MAX_SEEDS),
  exclude: z
    .array(z.string().regex(/^(movie|tv):\d+$/))
    .max(MAX_EXCLUDE_KEYS),
});

export async function POST(request: Request) {
  const limited = limitByIp(request);
  if (limited) return limited;
  const body = await readJsonBody(request);
  if (!body.ok) {
    const error = body.status === 413 ? 'Corpo grande demais.' : 'Corpo inválido.';
    return NextResponse.json({ error }, { status: body.status });
  }
  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Informe de 1 a ${MAX_SEEDS} sementes e até ${MAX_EXCLUDE_KEYS} chaves de exclusão.` },
      { status: 400 },
    );
  }
  const seeds: Seed[] = parsed.data.seeds;
  const exclude = new Set(parsed.data.exclude);
  const lookupsPerSeed = Math.min(RECS_PAGE_SIZE, Math.floor(MAX_LOOKUPS / seeds.length));

  const settled: PromiseSettledResult<MediaSummary[]>[] = [];
  for (let start = 0; start < seeds.length; start += SEED_BATCH) {
    const batch = seeds.slice(start, start + SEED_BATCH);
    settled.push(
      ...(await Promise.allSettled(
        batch.map((s) => getRecommendationsFor(s.mediaType, s.tmdbId, RECS_PER_SEED, lookupsPerSeed)),
      )),
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
