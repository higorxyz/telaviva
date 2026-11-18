import { cn } from '@/lib/cn';
import { PAGE_CONTAINER } from '@/ui/container';
import { Skeleton } from '@/ui/Skeleton';

/** App-shell fallback for detail pages while the title's data (and URL params) resolve. */
export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className={cn(PAGE_CONTAINER, 'flex min-h-[30rem] flex-col justify-end gap-6 pt-28 pb-8 md:min-h-[34rem] md:flex-row md:items-end md:gap-10 md:pt-40 md:pb-14')}>
        <Skeleton className="aspect-[2/3] w-36 shrink-0 rounded-lg sm:w-44 md:w-64 lg:w-72" />
        <div className="w-full max-w-3xl space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      </div>
    </div>
  );
}
