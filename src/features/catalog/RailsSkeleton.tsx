import { cn } from '@/lib/cn';
import { Skeleton } from '@/ui/Skeleton';
import { RAIL_ITEM_CLASS } from './sizes';

/** Rail-shaped placeholders shared by the home, the hubs and the detail pages. */
export function RailsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="mb-3 h-8 w-56" />
          <div className="flex gap-3 overflow-hidden sm:gap-4">
            {Array.from({ length: 8 }, (_, j) => (
              <Skeleton key={j} className={cn(RAIL_ITEM_CLASS, 'aspect-[2/3] shrink-0')} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
