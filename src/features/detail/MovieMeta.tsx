import type { ReactNode } from 'react';
import type { MovieDetails } from '@/features/tmdb/types';
import { formatRuntime, formatYear } from '@/lib/format';
import { CertificationBadge, DetailMeta } from './DetailMeta';

export function MovieMeta({ movie }: { movie: MovieDetails }) {
  const parts: ReactNode[] = [formatYear(movie.releaseDate), formatRuntime(movie.runtime)].filter(
    (p): p is string => Boolean(p),
  );
  if (movie.certification) parts.push(<CertificationBadge key="cert" value={movie.certification} />);
  return (
    <DetailMeta
      tagline={movie.tagline}
      voteAverage={movie.voteAverage}
      parts={parts}
      genres={movie.genres}
      mediaType="movie"
    />
  );
}
