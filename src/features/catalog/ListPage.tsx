import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/ui/Skeleton';
import { PAGE_CONTAINER } from '@/ui/container';
import { MediaGrid } from './MediaGrid';
import { PageHeader } from './PageHeader';
import { CATALOG_LISTS } from './lists';
import { CATALOG_LIST_META, isCatalogListId, type CatalogListId } from './list-ids';

type Kind = 'filmes' | 'series';

export function listIdsOf(kind: Kind): string[] {
  return (Object.keys(CATALOG_LIST_META) as CatalogListId[])
    .filter((id) => id.startsWith(`${kind}/`))
    .map((id) => id.slice(kind.length + 1));
}

export function listMeta(kind: Kind, lista: string) {
  const id = `${kind}/${lista}`;
  return isCatalogListId(id) ? CATALOG_LIST_META[id] : null;
}

function GridSkeleton() {
  return (
    <ul aria-hidden="true" className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
      {Array.from({ length: 16 }, (_, i) => (
        <li key={i}>
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </li>
      ))}
    </ul>
  );
}

/** Full list page: header plus an infinite grid seeded with the first page. */
export async function ListPage({ kind, lista }: { kind: Kind; lista: string }) {
  const id = `${kind}/${lista}`;
  if (!isCatalogListId(id)) notFound();
  const list = CATALOG_LISTS[id];
  const first = await list.fetch(1);
  return (
    <div className={`${PAGE_CONTAINER} pt-28 pb-14 md:pt-32`}>
      <PageHeader title={list.title} description={list.description} />
      {/* react-query reads Date.now(), so the client grid streams in behind a fallback. */}
      <Suspense fallback={<GridSkeleton />}>
        <MediaGrid endpoint={`/api/catalog?list=${id}`} initialPage={first} />
      </Suspense>
    </div>
  );
}
