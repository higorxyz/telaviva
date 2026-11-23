import type { Metadata } from 'next';
import { pageMeta } from '@/features/share/page-meta';
import { Suspense } from 'react';
import { SearchPrompt } from '@/features/search/SearchPrompt';
import { SearchView } from '@/features/search/SearchView';
import { PAGE_CONTAINER } from '@/ui/container';
import { Skeleton } from '@/ui/Skeleton';

export const metadata: Metadata = pageMeta({
  title: 'Buscar',
  description: 'Busque filmes, séries e pessoas no TelaViva.',
  path: '/buscar',
  noindex: true,
});

/**
 * The idle screen's shape (the field, then room for "Comece a digitar") while `?q=` is read on the client, so the
 * page keeps its height and the footer does not jump when the view renders.
 */
function SearchFallback() {
  return (
    <div>
      <Skeleton className="h-16 w-full rounded-full md:h-20" />
      {/* Invisible: with `?q=` the results replace it, so it must not flash; it only holds the height. */}
      <div aria-hidden="true" className="invisible mt-10 text-center">
        <SearchPrompt />
      </div>
    </div>
  );
}

export default function BuscarPage() {
  return (
    <div className={`${PAGE_CONTAINER} pt-28 pb-14 md:pt-32`}>
      <h1 className="sr-only">Buscar</h1>
      <Suspense fallback={<SearchFallback />}>
        <SearchView />
      </Suspense>
    </div>
  );
}
