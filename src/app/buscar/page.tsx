import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchView } from '@/features/search/SearchView';
import { PAGE_CONTAINER } from '@/ui/container';
import { Skeleton } from '@/ui/Skeleton';

export const metadata: Metadata = {
  title: 'Buscar',
  robots: { index: false },
};

export default function BuscarPage() {
  return (
    <div className={`${PAGE_CONTAINER} pt-24 pb-14 md:pt-32`}>
      <h1 className="sr-only">Buscar</h1>
      <Suspense fallback={<Skeleton className="h-16 w-full rounded-full md:h-20" />}>
        <SearchView />
      </Suspense>
    </div>
  );
}
