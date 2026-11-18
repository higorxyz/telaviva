import type { ImageResponse } from 'next/og';
import { resolveCanonical, type CanonicalKind } from '@/features/detail/canonical';
import { tmdbImage } from '@/features/tmdb/images';
import { getMovieDetails } from '@/features/tmdb/movies';
import { getPerson } from '@/features/tmdb/people';
import { getTvDetails } from '@/features/tmdb/tv';
import { formatYear } from '@/lib/format';
import { brandCard, ogCard, type OgCardProps } from './og';
import { toDataUri } from './og-assets';

const joinParts = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');

const DEPARTMENTS: Record<string, string> = {
  Acting: 'Atuação',
  Directing: 'Direção',
  Writing: 'Roteiro',
  Production: 'Produção',
};

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
      subtitle: DEPARTMENTS[p.knownForDepartment ?? ''] ?? p.knownForDepartment ?? 'Pessoa',
      rating: null,
      backdrop: null,
      poster: tmdbImage(p.profilePath, 'w342'),
    };
  },
};

/** Share image for a detail slug. Never throws: any failure (bad id, TMDb 404/5xx, image CDN) yields the brand card. */
export async function shareImage(slug: string, kind: CanonicalKind): Promise<ImageResponse> {
  try {
    const resolved = resolveCanonical({ slug }, kind);
    if (resolved === 'not-found') return brandCard();
    const card = await loaders[kind](resolved.id);
    const [backdrop, poster] = await Promise.all([toDataUri(card.backdrop), toDataUri(card.poster)]);
    return ogCard({ ...card, backdrop, poster });
  } catch (error) {
    console.error(`[og] ${kind} ${slug} fell back to the brand card`, error);
    return brandCard();
  }
}
