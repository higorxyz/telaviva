import { Hero, HERO_HEIGHT } from '@/features/catalog/Hero';
import { Rail } from '@/features/catalog/Rail';
import { dedupeRails, loadHomeRails, PER_RAIL } from '@/features/catalog/rails';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/ui/Skeleton';
import { getCurrentYear, getFeatured } from './data';
import { QuickActions } from './QuickActions';

const EDITORIAL_AFTER = 6;

export async function HeroSection() {
  const featured = await getFeatured();
  return featured ? <Hero item={featured.item} /> : <h1 className="sr-only">TelaViva — filmes e séries</h1>;
}

export function HeroSkeleton() {
  return <Skeleton className={cn('w-full rounded-none', HERO_HEIGHT)} />;
}

export async function HomeRails() {
  // Sources load in parallel with the featured pick; dedupe against it afterwards.
  const [featured, rails, year] = await Promise.all([getFeatured(), loadHomeRails(), getCurrentYear()]);
  const exclude = featured ? [featured.key] : [];
  const deduped = dedupeRails(rails, { perRail: PER_RAIL, exclude });
  return (
    <>
      {deduped.map((rail, i) => (
        <div key={rail.id} className="space-y-12 md:space-y-14">
          <Rail {...rail} priorityCount={i === 0 ? 2 : 0} />
          {i === Math.min(EDITORIAL_AFTER, deduped.length) - 1 ? <QuickActions year={year} /> : null}
        </div>
      ))}
    </>
  );
}

export function RailsSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <Skeleton className="mb-3 h-8 w-56" />
          <div className="flex gap-3 overflow-hidden sm:gap-4">
            {Array.from({ length: 8 }, (_, j) => (
              <Skeleton key={j} className="aspect-[2/3] w-[38vw] max-w-44 shrink-0 sm:w-36 lg:w-40" />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
