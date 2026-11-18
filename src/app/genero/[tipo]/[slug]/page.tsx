import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MediaGrid } from '@/features/catalog/MediaGrid';
import { PageHeader } from '@/features/catalog/PageHeader';
import { parseFilters, toTmdbParams } from '@/features/discover/filters';
import { discoverEndpoint } from '@/features/genres/genres';
import { loadCanonicalGenre, resolveGenre } from '@/features/genres/load-genre';
import { discover } from '@/features/tmdb/discover';
import { getGenres } from '@/features/tmdb/genres';
import { OG_BASE } from '@/features/share/page-meta';
import { genreHref } from '@/lib/slug';
import { PAGE_CONTAINER } from '@/ui/container';
import { Skeleton } from '@/ui/Skeleton';

type Props = PageProps<'/genero/[tipo]/[slug]'>;

/** Every genre of both media is prerendered (about 35 pages, all from two cached genre lists). */
export async function generateStaticParams() {
  const [movie, tv] = await Promise.all([getGenres('movie'), getGenres('tv')]);
  return [
    ...movie.map((g) => ({ tipo: 'filme', slug: genreHref({ mediaType: 'movie', ...g }).split('/').pop() as string })),
    ...tv.map((g) => ({ tipo: 'serie', slug: genreHref({ mediaType: 'tv', ...g }).split('/').pop() as string })),
  ];
}

const label = (tipo: 'filme' | 'serie') => (tipo === 'filme' ? 'Filmes' : 'Séries');

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tipo, genre, href } = await resolveGenre(params);
  const title = `${label(tipo)} de ${genre.name}`;
  const description = `Explore ${label(tipo).toLowerCase()} de ${genre.name.toLowerCase()}, com nota, ano e onde assistir no Brasil.`;
  return {
    title,
    description,
    alternates: { canonical: href },
    openGraph: { type: 'website', ...OG_BASE, title, description, url: href },
  };
}

function GridSkeleton() {
  return (
    <ul aria-hidden="true" className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
      {Array.from({ length: 16 }, (_, i) => (
        <li key={i}>
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </li>
      ))}
    </ul>
  );
}

export default async function GeneroPage({ params }: Props) {
  const { media, tipo, genre } = await loadCanonicalGenre(params);
  // Same params the API route builds from the endpoint, so page 1 matches what "load more" continues from.
  const filters = parseFilters(new URLSearchParams({ tipo, generos: String(genre.id) }));
  const first = await discover(media, toTmdbParams(filters), 1);
  return (
    <div className={`${PAGE_CONTAINER} pt-28 pb-14 md:pt-32`}>
      <PageHeader
        title={{ lead: `${label(tipo)} de`, accent: genre.name }}
        description="Os títulos mais populares do gênero, do mais ao menos visto."
      />
      <Suspense fallback={<GridSkeleton />}>
        <MediaGrid endpoint={discoverEndpoint(tipo, genre.id)} initialPage={first} />
      </Suspense>
    </div>
  );
}
