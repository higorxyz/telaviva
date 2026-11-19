import { Skeleton } from '@/ui/Skeleton';

/** Rail-shaped placeholders shared by the home and the hubs. */
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
