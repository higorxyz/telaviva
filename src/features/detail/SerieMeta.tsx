import type { ReactNode } from 'react';
import type { TvDetails } from '@/features/tmdb/types';
import { formatRuntime, formatYear } from '@/lib/format';
import { CertificationBadge, DetailMeta } from './DetailMeta';
import { statusLabel } from './seasons';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function SerieMeta({ tv }: { tv: TvDetails }) {
  const runtime = formatRuntime(tv.episodeRunTime);
  const parts: ReactNode[] = [
    formatYear(tv.releaseDate),
    statusLabel(tv.status),
    tv.numberOfSeasons > 0 ? plural(tv.numberOfSeasons, 'temporada', 'temporadas') : null,
    tv.numberOfEpisodes > 0 ? plural(tv.numberOfEpisodes, 'episódio', 'episódios') : null,
    runtime ? `${runtime} por episódio` : null,
  ].filter((p): p is string => Boolean(p));
  if (tv.certification) parts.push(<CertificationBadge key="cert" value={tv.certification} />);
  return <DetailMeta tagline={tv.tagline} voteAverage={tv.voteAverage} parts={parts} genres={tv.genres} mediaType="tv" />;
}
