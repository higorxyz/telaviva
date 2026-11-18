import { Rail } from '@/features/catalog/Rail';
import type { MovieDetails } from '@/features/tmdb/types';
import { CastRail } from './CastRail';
import { DetailSection } from './DetailSection';
import { FactsList } from './FactsList';
import { movieFacts } from './facts';
import { Trailer } from './Trailer';
import { WatchProviders } from './WatchProviders';

/** Body of the movie page, below the hero. Section order is part of the design. */
export function MovieSections({ movie }: { movie: MovieDetails }) {
  return (
    <div className="space-y-12 md:space-y-14">
      <DetailSection title={{ lead: 'Sinopse' }}>
        <p className="max-w-3xl text-lg leading-relaxed text-ivory/90">
          {movie.overview || 'Sinopse ainda não disponível.'}
        </p>
      </DetailSection>
      {movie.trailer ? (
        <DetailSection id="trailer" title={{ lead: 'Trailer' }}>
          <div className="max-w-4xl">
            <Trailer video={movie.trailer} title={movie.title} />
          </div>
        </DetailSection>
      ) : null}
      <DetailSection id="onde-assistir" title={{ lead: 'Onde', accent: 'assistir' }}>
        <WatchProviders providers={movie.providers} />
      </DetailSection>
      {movie.cast.length > 0 ? (
        <DetailSection id="elenco" title={{ lead: 'Elenco' }}>
          <CastRail cast={movie.cast} />
        </DetailSection>
      ) : null}
      <DetailSection id="ficha-tecnica" title={{ lead: 'Ficha', accent: 'técnica' }}>
        <FactsList facts={movieFacts(movie)} />
      </DetailSection>
      {movie.recommendations.length > 0 ? (
        <Rail
          id="recomendacoes"
          title={{ lead: 'Você também', accent: 'pode gostar' }}
          items={movie.recommendations}
        />
      ) : null}
    </div>
  );
}
