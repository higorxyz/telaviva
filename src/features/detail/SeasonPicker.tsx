import Link from 'next/link';
import type { SeasonSummary } from '@/features/tmdb/types';
import { cn } from '@/lib/cn';
import { seasonLabel } from './seasons';
import { SeasonSelect } from './SeasonSelect';

/** Season links (scrollable tabs from sm up) plus a select on mobile; both keep the page scroll position. */
export function SeasonPicker({
  seasons,
  current,
  baseHref,
}: {
  seasons: SeasonSummary[];
  current: number;
  baseHref: string;
}) {
  return (
    <div className="mb-6">
      <SeasonSelect seasons={seasons} current={current} baseHref={baseHref} />
      <nav aria-label="Temporadas" className="max-sm:hidden">
        {/* 4px of padding (offset by negative margins) keeps the focus ring inside the scroller's clip. */}
        <ul className="-mx-1 -mt-1 flex gap-2 overflow-x-auto px-1 pt-1 pb-2 [scrollbar-width:thin]">
          {seasons.map((s) => {
            const active = s.seasonNumber === current;
            return (
              <li key={s.seasonNumber} className="shrink-0">
                <Link
                  href={`${baseHref}?temporada=${s.seasonNumber}`}
                  scroll={false}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'inline-block rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
                    active
                      ? 'border-amber bg-amber text-ink-950'
                      : 'border-ink-600 text-ivory hover:border-amber hover:text-amber',
                  )}
                >
                  {seasonLabel(s)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
