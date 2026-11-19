import type { Metadata } from 'next';
import { pageMeta } from '@/features/share/page-meta';
import { Suspense } from 'react';
import { RailsSkeleton } from '@/features/catalog/RailsSkeleton';
import { HeroSection, HeroSkeleton, HomeRails } from '@/features/home/HomeSections';
import { LibraryRails } from '@/features/home/LibraryRails';
import { PAGE_CONTAINER } from '@/ui/container';
import { cn } from '@/lib/cn';

export const metadata: Metadata = pageMeta({
  title: { absolute: 'TelaViva — filmes e séries' },
  description: 'Descubra filmes e séries, com onde assistir no Brasil.',
  path: '/',
});

export default function Home() {
  return (
    <>
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />
      </Suspense>
      <div className={cn(PAGE_CONTAINER, 'space-y-12 py-10 md:space-y-14 md:py-14')}>
        <LibraryRails />
        <Suspense fallback={<RailsSkeleton />}>
          <HomeRails />
        </Suspense>
      </div>
    </>
  );
}
