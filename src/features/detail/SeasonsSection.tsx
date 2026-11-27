import { Suspense, type ReactNode } from 'react';
import type { EpisodeSummary, SeasonDetails, TvDetails } from '@/features/tmdb/types';
import { mediaHref } from '@/lib/slug';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton } from '@/ui/Skeleton';
import { DetailSection } from './DetailSection';
import { EpisodeList } from './EpisodeList';
import { loadSeason } from './load-season';
import { defaultSeason, orderSeasons, parseSeasonParam } from './seasons';
import { SeasonPicker } from './SeasonPicker';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type RenderAction = (episode: EpisodeSummary, aired: boolean) => ReactNode;
type RenderSeasonActions = (season: SeasonDetails, airedEpisodeNumbers: number[]) => ReactNode;

async function Episodes({
  tv,
  searchParams,
  renderAction,
  renderSeasonActions,
}: {
  tv: TvDetails;
  searchParams: SearchParams;
  renderAction?: RenderAction;
  renderSeasonActions?: RenderSeasonActions;
}) {
  const seasons = orderSeasons(tv.seasons);
  const current = parseSeasonParam((await searchParams).temporada, seasons) ?? defaultSeason(tv);
  if (current === null) return <EmptyState title="Ainda não há episódios cadastrados." />;
  const result = await loadSeason(tv.id, current);
  return (
    <>
      <SeasonPicker seasons={seasons} current={current} baseHref={mediaHref(tv)} />
      {result.status === 'ok' ? (
        <EpisodeList season={result.season} renderAction={renderAction} renderSeasonActions={renderSeasonActions} />
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
 *
 * `after` (the sections below this one) streams in the same boundary, so it never sits under the placeholder in the
 * static shell (see DetailSections). The placeholder keeps the section title, as before.
 */
export function SeasonsSection({
  tv,
  searchParams,
  renderAction,
  renderSeasonActions,
  after,
}: {
  tv: TvDetails;
  searchParams: SearchParams;
  /** Per-episode slot (Phase 2: mark as watched), passed through to EpisodeList. */
  renderAction?: RenderAction;
  /** Season-level slot above the episode list (Phase 2: mark the whole season). */
  renderSeasonActions?: RenderSeasonActions;
  /** What follows the section on the page, streamed together with the episodes. */
  after?: ReactNode;
}) {
  const title = { lead: 'Temporadas e', accent: 'episódios' };
  return (
    <Suspense
      fallback={
        <DetailSection id="episodios" title={title}>
          <Skeleton className="h-96 w-full" />
        </DetailSection>
      }
    >
      <DetailSection id="episodios" title={title}>
        <Episodes
          tv={tv}
          searchParams={searchParams}
          renderAction={renderAction}
          renderSeasonActions={renderSeasonActions}
        />
      </DetailSection>
      {after}
    </Suspense>
  );
}
