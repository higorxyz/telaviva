import { Suspense } from 'react';
import { getSeason } from '@/features/tmdb/tv';
import type { TvDetails } from '@/features/tmdb/types';
import { mediaHref } from '@/lib/slug';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton } from '@/ui/Skeleton';
import { DetailSection } from './DetailSection';
import { EpisodeList } from './EpisodeList';
import { defaultSeason, orderSeasons, parseSeasonParam } from './seasons';
import { SeasonPicker } from './SeasonPicker';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Episodes({ tv, searchParams }: { tv: TvDetails; searchParams: SearchParams }) {
  const seasons = orderSeasons(tv.seasons);
  const current = parseSeasonParam((await searchParams).temporada, seasons) ?? defaultSeason(tv);
  if (current === null) return <EmptyState title="Ainda não há episódios cadastrados." />;
  const season = await getSeason(tv.id, current).catch(() => null);
  return (
    <>
      <SeasonPicker seasons={seasons} current={current} baseHref={mediaHref(tv)} />
      {season ? (
        <EpisodeList season={season} />
      ) : (
        <EmptyState title="Não foi possível carregar os episódios." description="Tente outra temporada ou volte mais tarde." />
      )}
    </>
  );
}

/**
 * Seasons and episodes. `searchParams` is read only here, inside Suspense, so the page itself stays
 * static-friendly and keeps real 308/404 status codes.
 */
export function SeasonsSection({ tv, searchParams }: { tv: TvDetails; searchParams: SearchParams }) {
  return (
    <DetailSection id="episodios" title={{ lead: 'Temporadas e', accent: 'episódios' }}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Episodes tv={tv} searchParams={searchParams} />
      </Suspense>
    </DetailSection>
  );
}
