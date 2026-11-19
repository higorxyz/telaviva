import type { Metadata } from 'next';
import { DetailHero } from '@/features/detail/DetailHero';
import { loadByIdSlug, loadCanonicalPage } from '@/features/detail/load-canonical';
import { MovieMeta } from '@/features/detail/MovieMeta';
import { DetailSections } from '@/features/detail/DetailSections';
import { movieFacts } from '@/features/detail/facts';
import { truncateSummary } from '@/features/detail/summary';
import { getMovieDetails } from '@/features/tmdb/movies';
import { mediaHref } from '@/lib/slug';
import { OG_BASE } from '@/features/share/page-meta';
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
  return {
    title: movie.title,
    description,
    alternates: { canonical },
    openGraph: {
      ...OG_BASE,
      type: 'video.movie',
      title: movie.title,
      description,
      url: canonical,
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
      <DetailHero backHref="/filmes" item={movie} meta={<MovieMeta movie={movie} />} />
      <div className={`${PAGE_CONTAINER} py-10 md:py-14`}>
        <DetailSections item={movie} facts={movieFacts(movie)} />
      </div>
    </>
  );
}
