import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HeroSection, HeroSkeleton, HomeRails, RailsSkeleton } from '@/features/home/HomeSections';
import { PAGE_CONTAINER } from '@/ui/container';
import { cn } from '@/lib/cn';

export const metadata: Metadata = {
  title: { absolute: 'TelaViva — filmes e séries' },
  description: 'Descubra filmes e séries, com onde assistir no Brasil.',
};

export default function Home() {
  return (
    <>
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />
      </Suspense>
      <div className={cn(PAGE_CONTAINER, 'space-y-12 py-10 md:space-y-14 md:py-14')}>
        <Suspense fallback={<RailsSkeleton />}>
          <HomeRails />
        </Suspense>
      </div>
    </>
  );
}
