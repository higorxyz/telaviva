import type { ReactNode } from 'react';
import type { MovieDetails, TvDetails } from '@/features/tmdb/types';
import { CastRail } from './CastRail';
import { DetailSection } from './DetailSection';
import { FactsList } from './FactsList';
import { RecommendationsSection } from './RecommendationsSection';
import { Trailer } from './Trailer';
import { WatchProviders } from './WatchProviders';

/**
 * Body of a detail page, below the hero. Section order is part of the design;
 * `afterOverview` and `afterTrailer` are where the series page slots in its extra blocks.
 *
 * `afterTrailer` receives the sections that follow it (where to watch, cast, facts, recommendations) and places them.
 * The series page streams them inside its seasons boundary: in the static shell they would sit right under the
 * 24rem episodes placeholder, close enough to the screen that the browser fetches every cast photo while the page
 * loads, competing with the backdrop (the LCP). Streamed with the episodes, they arrive at their real place, far below.
 */
export function DetailSections({
  item,
  facts,
  afterOverview,
  afterTrailer,
}: {
  item: MovieDetails | TvDetails;
  facts: Array<{ label: string; value: ReactNode }>;
  afterOverview?: ReactNode;
  afterTrailer?: (rest: ReactNode) => ReactNode;
}) {
  const rest = (
    <>
      <DetailSection id="onde-assistir" title={{ lead: 'Onde', accent: 'assistir' }}>
        <WatchProviders providers={item.providers} />
      </DetailSection>
      {item.cast.length > 0 ? (
        <DetailSection id="elenco" title={{ lead: 'Elenco' }}>
          <CastRail cast={item.cast} />
        </DetailSection>
      ) : null}
      <DetailSection id="ficha-tecnica" title={{ lead: 'Ficha', accent: 'técnica' }}>
        <FactsList facts={facts} />
      </DetailSection>
      <RecommendationsSection media={item.mediaType} id={item.id} items={item.recommendations} />
    </>
  );
  return (
    <div className="space-y-12 md:space-y-14">
      <DetailSection title={{ lead: 'Sinopse' }}>
        <p className="max-w-3xl text-lg leading-relaxed text-ivory/90">
          {item.overview || 'Sinopse ainda não disponível.'}
        </p>
        {afterOverview}
      </DetailSection>
      {item.trailer ? (
        <DetailSection id="trailer" title={{ lead: 'Trailer' }}>
          <div className="max-w-4xl">
            <Trailer video={item.trailer} title={item.title} />
          </div>
        </DetailSection>
      ) : null}
      {afterTrailer ? afterTrailer(rest) : rest}
    </div>
  );
}
