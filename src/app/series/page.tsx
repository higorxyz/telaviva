import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HubRails, HubSkeleton } from '@/features/catalog/HubRails';
import { PageHeader } from '@/features/catalog/PageHeader';
import { PAGE_CONTAINER } from '@/ui/container';

export const metadata: Metadata = {
  title: 'Séries',
  description: 'Séries em alta, no ar e as mais bem avaliadas, com onde assistir no Brasil.',
  alternates: { canonical: '/series' },
};

export default function SeriesPage() {
  return (
    <div className={`${PAGE_CONTAINER} pt-28 pb-14 md:pt-32`}>
      <PageHeader title={{ lead: 'Séries', accent: 'para maratonar' }} />
      <div className="space-y-12 md:space-y-14">
        <Suspense fallback={<HubSkeleton />}>
          <HubRails media="tv" />
        </Suspense>
      </div>
    </div>
  );
}
