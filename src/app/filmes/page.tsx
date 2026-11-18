import type { Metadata } from 'next';
import { pageMeta } from '@/features/share/page-meta';
import { Suspense } from 'react';
import { HubRails, HubSkeleton } from '@/features/catalog/HubRails';
import { PageHeader } from '@/features/catalog/PageHeader';
import { PAGE_CONTAINER } from '@/ui/container';

export const metadata: Metadata = pageMeta({
  title: 'Filmes',
  description: 'Filmes em cartaz, em alta, joias escondidas e muito mais, com onde assistir no Brasil.',
  path: '/filmes',
});

export default function FilmesPage() {
  return (
    <div className={`${PAGE_CONTAINER} pt-28 pb-14 md:pt-32`}>
      <PageHeader title={{ lead: 'Filmes', accent: 'em cartaz e além' }} />
      <div className="space-y-12 md:space-y-14">
        <Suspense fallback={<HubSkeleton />}>
          <HubRails media="movie" />
        </Suspense>
      </div>
    </div>
  );
}
