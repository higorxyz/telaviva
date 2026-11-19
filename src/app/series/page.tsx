import type { Metadata } from 'next';
import { pageMeta } from '@/features/share/page-meta';
import { Suspense } from 'react';
import { HubRails } from '@/features/catalog/HubRails';
import { RailsSkeleton } from '@/features/catalog/RailsSkeleton';
import { PageHeader } from '@/features/catalog/PageHeader';
import { PAGE_CONTAINER } from '@/ui/container';

export const metadata: Metadata = pageMeta({
  title: 'Séries',
  description: 'Séries em alta, no ar e as mais bem avaliadas, com onde assistir no Brasil.',
  path: '/series',
});

export default function SeriesPage() {
  return (
    <div className={`${PAGE_CONTAINER} pt-28 pb-14 md:pt-32`}>
      <PageHeader title={{ lead: 'Séries', accent: 'para maratonar' }} />
      <div className="space-y-12 md:space-y-14">
        <Suspense fallback={<RailsSkeleton />}>
          <HubRails media="tv" />
        </Suspense>
      </div>
    </div>
  );
}
