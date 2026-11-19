import type { Metadata } from 'next';
import { DetailHero } from '@/features/detail/DetailHero';
import { DetailSections } from '@/features/detail/DetailSections';
import { tvFacts } from '@/features/detail/facts';
import { loadByIdSlug, loadCanonicalPage } from '@/features/detail/load-canonical';
import { NextEpisode } from '@/features/detail/NextEpisode';
import { SeasonsSection } from '@/features/detail/SeasonsSection';
import { SerieMeta } from '@/features/detail/SerieMeta';
import { truncateSummary } from '@/features/detail/summary';
import { SeriesActions } from '@/features/library/SeriesActions';
import { SeriesProgressCard } from '@/features/library/SeriesProgressCard';
import { toProgressInfo } from '@/features/library/progress';
import { toSnapshot } from '@/features/library/snapshot';
import { getTvDetails } from '@/features/tmdb/tv';
import { mediaHref } from '@/lib/slug';
import { OG_BASE } from '@/features/share/page-meta';
import { PAGE_CONTAINER } from '@/ui/container';

type Props = PageProps<'/serie/[slug]'>;

/** Prerenders one title; every other id renders on demand. */
export function generateStaticParams() {
  return [{ slug: '1399-game-of-thrones' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tv = await loadByIdSlug(slug, 'serie', getTvDetails);
  const canonical = mediaHref(tv);
  const description = truncateSummary(tv.overview) || undefined;
  return {
    title: tv.title,
    description,
    alternates: { canonical },
    openGraph: {
      ...OG_BASE,
      type: 'video.tv_show',
      title: tv.title,
      description,
      url: canonical,
    },
  };
}

/** Only `params` is awaited here; `searchParams` goes to the Suspense'd seasons section (see SeasonsSection). */
export default async function SeriePage({ params, searchParams }: Props) {
  const tv = await loadCanonicalPage({
    params,
    kind: 'serie',
    load: getTvDetails,
    hrefOf: mediaHref,
  });

  const info = toProgressInfo(tv);

  return (
    <>
      <DetailHero
        backHref="/series"
        item={tv}
        meta={<SerieMeta tv={tv} />}
        actions={<SeriesActions tv={tv} info={info} />}
      />
      <div className={`${PAGE_CONTAINER} py-10 md:py-14`}>
        <DetailSections
          item={tv}
          facts={tvFacts(tv)}
          afterOverview={
            <>
              <SeriesProgressCard tvId={tv.id} title={tv.title} info={info} snapshot={toSnapshot(tv)} />
              {tv.nextEpisodeToAir ? <NextEpisode episode={tv.nextEpisodeToAir} /> : null}
            </>
          }
          afterTrailer={<SeasonsSection tv={tv} searchParams={searchParams} />}
        />
      </div>
    </>
  );
}
