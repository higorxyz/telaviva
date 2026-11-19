import type { Metadata } from 'next';
import { pageMeta } from '@/features/share/page-meta';
import { Suspense } from 'react';
import { PageHeader } from '@/features/catalog/PageHeader';
import { GridSkeleton } from '@/features/catalog/GridSkeleton';
import { DiscoverView } from '@/features/discover/DiscoverView';
import { getGenres, getWatchProviderCatalog } from '@/features/tmdb/genres';
import { PAGE_CONTAINER } from '@/ui/container';
import { Skeleton } from '@/ui/Skeleton';

export const metadata: Metadata = pageMeta({
  title: 'Descobrir',
  description: 'Filtre filmes e séries por gênero, ano, nota, duração, idioma e onde assistir no Brasil.',
  path: '/descobrir',
});

/** Same rhythm as the view: presets row, toolbar row, then the grid. */
function ViewSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-11 w-full max-w-md rounded-full md:h-9" />
      <Skeleton className="mt-6 mb-8 h-11 w-full rounded-full" />
      <GridSkeleton count={16} />
    </div>
  );
}

export default async function DescobrirPage() {
  // Cached TMDb catalogs; the URL-driven view below streams in behind the Suspense boundary.
  // The provider catalog is optional: without it the panel just has no "Onde assistir" picker.
  const providers = (media: 'movie' | 'tv') =>
    getWatchProviderCatalog(media).catch((error: unknown) => {
      console.error(`[descobrir] provider catalog (${media}) failed:`, error);
      return [];
    });
  const [movieGenres, tvGenres, movieProviders, tvProviders] = await Promise.all([
    getGenres('movie'),
    getGenres('tv'),
    providers('movie'),
    providers('tv'),
  ]);
  const catalog = {
    genres: { movie: movieGenres, tv: tvGenres },
    providers: { movie: movieProviders, tv: tvProviders },
  };
  return (
    <div className={`${PAGE_CONTAINER} pt-28 pb-14 md:pt-32`}>
      <PageHeader
        title={{ lead: 'Descobrir', accent: 'algo bom' }}
        description="Afine por gênero, ano, nota, duração e onde assistir no Brasil."
      />
      <Suspense fallback={<ViewSkeleton />}>
        <DiscoverView catalog={catalog} />
      </Suspense>
    </div>
  );
}
