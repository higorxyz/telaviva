import type { Metadata } from 'next';
import { pageMeta } from '@/features/share/page-meta';
import { Suspense } from 'react';
import { PageHeader } from '@/features/catalog/PageHeader';
import { DiscoverView } from '@/features/discover/DiscoverView';
import { getGenres, getWatchProviderCatalog } from '@/features/tmdb/genres';
import { PAGE_CONTAINER } from '@/ui/container';
import { Skeleton } from '@/ui/Skeleton';

export const metadata: Metadata = pageMeta({
  title: 'Descobrir',
  description: 'Filtre filmes e séries por gênero, ano, nota, duração, idioma e onde assistir no Brasil.',
  path: '/descobrir',
});

function ViewSkeleton() {
  return (
    <div className="flex gap-8" aria-hidden="true">
      <Skeleton className="hidden h-[40rem] w-72 shrink-0 md:block" />
      <Skeleton className="h-[40rem] flex-1" />
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
