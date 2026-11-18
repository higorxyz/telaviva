import type { ReactNode } from 'react';
import { Rail } from '@/features/catalog/Rail';
import type { MovieDetails, TvDetails } from '@/features/tmdb/types';
import { CastRail } from './CastRail';
import { DetailSection } from './DetailSection';
import { FactsList } from './FactsList';
import { Trailer } from './Trailer';
import { WatchProviders } from './WatchProviders';

/**
 * Body of a detail page, below the hero. Section order is part of the design;
 * `afterOverview` and `afterTrailer` are where the series page slots in its extra blocks.
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
  afterTrailer?: ReactNode;
}) {
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
      {afterTrailer}
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
      {item.recommendations.length > 0 ? (
        <Rail
          id="recomendacoes"
          title={{ lead: 'Você também', accent: 'pode gostar' }}
          items={item.recommendations}
        />
      ) : null}
    </div>
  );
}
