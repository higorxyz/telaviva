import { Suspense, type ReactNode } from 'react';
import type { EpisodeSummary, TvDetails } from '@/features/tmdb/types';
import { mediaHref } from '@/lib/slug';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton } from '@/ui/Skeleton';
import { DetailSection } from './DetailSection';
import { EpisodeList } from './EpisodeList';
import { loadSeason } from './load-season';
import { defaultSeason, orderSeasons, parseSeasonParam } from './seasons';
import { SeasonPicker } from './SeasonPicker';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type RenderAction = (episode: EpisodeSummary) => ReactNode;

async function Episodes({
  tv,
  searchParams,
  renderAction,
}: {
  tv: TvDetails;
  searchParams: SearchParams;
  renderAction?: RenderAction;
}) {
  const seasons = orderSeasons(tv.seasons);
  const current = parseSeasonParam((await searchParams).temporada, seasons) ?? defaultSeason(tv);
  if (current === null) return <EmptyState title="Ainda não há episódios cadastrados." />;
  const result = await loadSeason(tv.id, current);
  return (
    <>
      <SeasonPicker seasons={seasons} current={current} baseHref={mediaHref(tv)} />
      {result.status === 'ok' ? (
        <EpisodeList season={result.season} renderAction={renderAction} />
      ) : result.status === 'missing' ? (
        <EmptyState title="Ainda não há episódios cadastrados." />
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
export function SeasonsSection({
  tv,
  searchParams,
  renderAction,
}: {
  tv: TvDetails;
  searchParams: SearchParams;
  /** Per-episode slot (Phase 2: mark as watched), passed through to EpisodeList. */
  renderAction?: RenderAction;
}) {
  return (
    <DetailSection id="episodios" title={{ lead: 'Temporadas e', accent: 'episódios' }}>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Episodes tv={tv} searchParams={searchParams} renderAction={renderAction} />
      </Suspense>
    </DetailSection>
  );
}
