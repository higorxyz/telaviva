import Link from 'next/link';
import { tmdbImage } from '@/features/tmdb/images';
import type { PersonSummary } from '@/features/tmdb/types';
import { personHref } from '@/lib/slug';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function PersonCard({ person }: { person: PersonSummary }) {
  const src = tmdbImage(person.profilePath, 'w185');
  return (
    <Link
      href={personHref(person)}
      className="group flex flex-col items-center gap-2 rounded-lg p-2 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
    >
      <span className="grid size-24 place-items-center overflow-hidden rounded-full border border-ink-600 bg-ink-800 transition-colors group-hover:border-amber motion-reduce:transition-none">
        {src ? (
          <img src={src} alt="" width={185} height={185} loading="lazy" className="size-full object-cover" />
        ) : (
          <span aria-hidden="true" className="font-display text-2xl text-ivory-muted">
            {initials(person.name)}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-sm font-medium text-ivory">{person.name}</span>
      {person.knownForDepartment ? <span className="text-xs text-ivory-muted">{person.knownForDepartment}</span> : null}
    </Link>
  );
}
