import { Skeleton } from '@/ui/Skeleton';
import { gridSizes } from './sizes';

export const GRID_CLASS =
  'grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8';

/** Rendered poster width in GRID_CLASS, for `<img sizes>`. */
export const GRID_SIZES = gridSizes([3, 4, 5, 6, 7, 8]);

/** Poster-grid placeholder shared by list, genre, discover and search pages. */
export function GridSkeleton({ count = 16, className = GRID_CLASS }: { count?: number; className?: string }) {
  return (
    <ul aria-hidden="true" className={className}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </li>
      ))}
    </ul>
  );
}
