import Link from 'next/link';
import { tmdbImage } from '@/features/tmdb/images';
import type { CastMember } from '@/features/tmdb/types';
import { personHref } from '@/lib/slug';

export function CastRail({ cast }: { cast: CastMember[] }) {
  return (
    <ul className="flex snap-x gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {cast.map((member) => {
        const src = tmdbImage(member.profilePath, 'w185');
        return (
          <li key={member.id} className="w-28 shrink-0 snap-start sm:w-32">
            <Link
              href={personHref(member)}
              className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
            >
              <div className="aspect-[2/3] overflow-hidden rounded-lg border border-ink-600 bg-ink-800 transition-colors group-hover:border-amber">
                {src ? (
                  <img
                    src={src}
                    alt=""
                    width={185}
                    height={278}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                ) : (
                  <div data-testid="profile-placeholder" aria-hidden="true" className="grid size-full place-items-center font-display text-4xl text-ivory-muted">
                    {member.name.charAt(0)}
                  </div>
                )}
              </div>
              <p className="mt-2 line-clamp-2 font-sans text-sm font-medium text-ivory">{member.name}</p>
              {member.character ? (
                <p className="line-clamp-2 font-sans text-xs text-ivory-muted">{member.character}</p>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
