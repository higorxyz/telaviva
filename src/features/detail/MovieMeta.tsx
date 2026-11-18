import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MovieDetails } from '@/features/tmdb/types';
import { formatRuntime, formatYear } from '@/lib/format';
import { genreHref } from '@/lib/slug';
import { RatingRing } from '@/ui/RatingRing';

/** BR content rating as a bordered badge; "L" is livre. */
export function CertificationBadge({ value }: { value: string }) {
  const code = value.toUpperCase();
  const label = code === 'L' ? 'Livre' : `${code} anos`;
  return (
    <span
      title={`Classificação indicativa: ${label}`}
      className="inline-grid min-w-7 place-items-center rounded border border-ivory/60 px-1.5 py-0.5 text-xs font-semibold text-ivory"
    >
      <span aria-hidden="true">{code}</span>
      <span className="sr-only">Classificação indicativa: {label}</span>
    </span>
  );
}

export function MovieMeta({ movie }: { movie: MovieDetails }) {
  const items: ReactNode[] = [formatYear(movie.releaseDate), formatRuntime(movie.runtime)].filter(
    (p): p is string => Boolean(p),
  );
  if (movie.certification) items.push(<CertificationBadge key="cert" value={movie.certification} />);

  return (
    <div className="mt-4 space-y-4 font-sans">
      {movie.tagline ? <p className="font-display text-xl text-ivory/85 italic md:text-2xl">{movie.tagline}</p> : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ivory-muted">
        <RatingRing value={movie.voteAverage} size="lg" />
        {items.map((part, i) => (
          <span key={i} className="flex items-center gap-3">
            {part}
            {/* Separator trails its item, so a wrapped line never starts with it. */}
            {i < items.length - 1 ? <span aria-hidden="true">·</span> : null}
          </span>
        ))}
      </div>
      {movie.genres.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Gêneros">
          {movie.genres.map((g) => (
            <li key={g.id}>
              <Link
                href={genreHref({ mediaType: 'movie', ...g })}
                className="inline-block rounded-full border border-ivory/30 px-3 py-1 text-sm text-ivory transition-colors hover:border-amber hover:text-amber"
              >
                {g.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
