import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { assertCanonical, isCanonical, resolveCanonical, toSearchString } from '@/features/detail/canonical';
import { DetailSkeleton } from '@/features/detail/DetailSkeleton';
import { DetailHero } from '@/features/detail/DetailHero';
import { MovieMeta } from '@/features/detail/MovieMeta';
import { MovieSections } from '@/features/detail/MovieSections';
import { truncateSummary } from '@/features/detail/summary';
import { isTmdbNotFound } from '@/features/tmdb/client';
import { tmdbImage } from '@/features/tmdb/images';
import { getMovieDetails } from '@/features/tmdb/movies';
import type { MovieDetails } from '@/features/tmdb/types';
import { mediaHref } from '@/lib/slug';
import { PAGE_CONTAINER } from '@/ui/container';

/** Prerenders one title; every other id renders on demand. */
export function generateStaticParams() {
  return [{ slug: '550-clube-da-luta' }];
}

async function loadMovie(slug: string): Promise<MovieDetails> {
  const resolved = resolveCanonical({ slug }, 'filme');
  if (resolved === 'not-found') notFound();
  try {
    return await getMovieDetails(resolved.id);
  } catch (error) {
    if (isTmdbNotFound(error)) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps<'/filme/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const movie = await loadMovie(slug);
  const canonical = mediaHref(movie);
  const description = truncateSummary(movie.overview) || undefined;
  const image = tmdbImage(movie.backdropPath ?? movie.posterPath, 'w780');
  return {
    title: movie.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'video.movie',
      title: movie.title,
      description,
      url: canonical,
      images: image ? [image] : undefined,
    },
  };
}

type Props = PageProps<'/filme/[slug]'>;

async function FilmeContent({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  const { slug } = await params;
  const movie = await loadMovie(slug);
  const canonical = mediaHref(movie);
  // searchParams is only awaited when redirecting, so canonical (prerendered) URLs stay static.
  if (!isCanonical(slug, canonical)) assertCanonical(slug, canonical, toSearchString(await searchParams));

  return (
    <>
      <DetailHero item={movie} meta={<MovieMeta movie={movie} />} />
      <div className={`${PAGE_CONTAINER} py-10 md:py-14`}>
        <MovieSections movie={movie} />
      </div>
    </>
  );
}

/** URL data is read inside Suspense so unlisted ids can serve the app shell (Partial Prefetching). */
export default function FilmePage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <FilmeContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
