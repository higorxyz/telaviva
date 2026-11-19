import type { Metadata } from 'next';
import { pageMeta } from '@/features/share/page-meta';
import { Suspense } from 'react';
import { SearchView } from '@/features/search/SearchView';
import { PAGE_CONTAINER } from '@/ui/container';
import { Skeleton } from '@/ui/Skeleton';

export const metadata: Metadata = pageMeta({
  title: 'Buscar',
  description: 'Busque filmes, séries e pessoas no TelaViva.',
  path: '/buscar',
  noindex: true,
});

export default function BuscarPage() {
  return (
    <div className={`${PAGE_CONTAINER} pt-28 pb-14 md:pt-32`}>
      <h1 className="sr-only">Buscar</h1>
      <Suspense fallback={<Skeleton className="h-16 w-full rounded-full md:h-20" />}>
        <SearchView />
      </Suspense>
    </div>
  );
}
