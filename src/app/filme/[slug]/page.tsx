import type { Metadata } from 'next';
import { DetailHero } from '@/features/detail/DetailHero';
import { loadByIdSlug, loadCanonicalPage } from '@/features/detail/load-canonical';
import { MovieMeta } from '@/features/detail/MovieMeta';
import { MovieSections } from '@/features/detail/MovieSections';
import { truncateSummary } from '@/features/detail/summary';
import { tmdbImage } from '@/features/tmdb/images';
import { getMovieDetails } from '@/features/tmdb/movies';
import { mediaHref } from '@/lib/slug';
import { PAGE_CONTAINER } from '@/ui/container';

type Props = PageProps<'/filme/[slug]'>;


/** Prerenders one title; every other id renders on demand. */
export function generateStaticParams() {
  return [{ slug: '550-clube-da-luta' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const movie = await loadByIdSlug(slug, 'filme', getMovieDetails);
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

export default async function FilmePage({ params }: Props) {
  const movie = await loadCanonicalPage({
    params,
    kind: 'filme',
    load: getMovieDetails,
    hrefOf: mediaHref,
  });

  return (
    <>
      <DetailHero item={movie} meta={<MovieMeta movie={movie} />} />
      <div className={`${PAGE_CONTAINER} py-10 md:py-14`}>
        <MovieSections movie={movie} />
      </div>
    </>
  );
}
