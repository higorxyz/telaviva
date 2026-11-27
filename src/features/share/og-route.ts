import type { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { resolveCanonical, type CanonicalKind } from '@/features/detail/canonical';
import { tmdbImage } from '@/features/tmdb/images';
import { getMovieDetails } from '@/features/tmdb/movies';
import { getPerson } from '@/features/tmdb/people';
import { getTvDetails } from '@/features/tmdb/tv';
import { formatYear } from '@/lib/format';
import { departmentLabel } from '@/lib/people';
import { brandCard, ogCard, type OgCardProps } from './og';
import { toDataUri } from './og-assets';

const joinParts = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');

const loaders: Record<CanonicalKind, (id: number) => Promise<OgCardProps>> = {
  async filme(id) {
    const m = await getMovieDetails(id);
    return {
      title: m.title,
      subtitle: joinParts(formatYear(m.releaseDate), m.genres[0]?.name),
      rating: m.voteAverage,
      backdrop: tmdbImage(m.backdropPath, 'w780'),
      poster: tmdbImage(m.posterPath, 'w342'),
    };
  },
  async serie(id) {
    const t = await getTvDetails(id);
    return {
      title: t.title,
      subtitle: joinParts('Série', formatYear(t.releaseDate), t.genres[0]?.name),
      rating: t.voteAverage,
      backdrop: tmdbImage(t.backdropPath, 'w780'),
      poster: tmdbImage(t.posterPath, 'w342'),
    };
  },
  async pessoa(id) {
    const p = await getPerson(id);
    return {
      title: p.name,
      subtitle: p.knownForDepartment ? departmentLabel(p.knownForDepartment) : 'Pessoa',
      rating: null,
      backdrop: null,
      poster: tmdbImage(p.profilePath, 'w342'),
    };
  },
};

export const FULL_CACHE = 'public, max-age=86400, stale-while-revalidate=604800';
export const DEGRADED_CACHE = 'public, max-age=300';

/** `next/og` only emits PNG; photographic cards are ~1 MB, so re-encode to JPEG to stay under WhatsApp's preview limit. */
export async function toJpeg(image: ImageResponse, cacheControl: string): Promise<Response> {
  const png = Buffer.from(await image.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { 'content-type': 'image/jpeg', 'cache-control': cacheControl },
  });
}

/** Brand card as JPEG; if sharp itself fails, the PNG from next/og with the short cache. Never throws. */
export async function brandJpeg(cacheControl: string): Promise<Response> {
  try {
    return await toJpeg(brandCard(), cacheControl);
  } catch (error) {
    console.error('[og] JPEG encoding failed, serving the PNG brand card', error);
    const png = brandCard();
    return new Response(png.body, {
      headers: { 'content-type': 'image/png', 'cache-control': DEGRADED_CACHE },
    });
  }
}

/**
 * Share image for a detail slug, as JPEG. Never throws: any failure (bad id, TMDb 404/5xx, image CDN) yields the
 * brand card. Explicit cache headers: a full card is cached for a day; a degraded card (missing images) or the
 * brand fallback only for 5 minutes, so a transient failure is not frozen.
 */
export async function shareImage(slug: string, kind: CanonicalKind): Promise<Response> {
  try {
    const resolved = resolveCanonical({ slug }, kind);
    if (resolved === 'not-found') return await brandJpeg(DEGRADED_CACHE);
    const card = await loaders[kind](resolved.id);
    const [backdrop, poster] = await Promise.all([toDataUri(card.backdrop), toDataUri(card.poster)]);
    const complete = (!card.backdrop || backdrop) && (!card.poster || poster);
    return await toJpeg(ogCard({ ...card, backdrop, poster }), complete ? FULL_CACHE : DEGRADED_CACHE);
  } catch (error) {
    console.error(`[og] ${kind} ${slug} fell back to the brand card`, error);
    return brandJpeg(DEGRADED_CACHE);
  }
}
