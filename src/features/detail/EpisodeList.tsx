import type { ReactNode } from 'react';
import { saoPauloIsoDate } from '@/features/tmdb/dates';
import { stillSrcSet, tmdbImage } from '@/features/tmdb/images';
import type { EpisodeSummary, SeasonDetails } from '@/features/tmdb/types';
import { formatDate, formatRuntime } from '@/lib/format';
import { EmptyState } from '@/ui/EmptyState';
import { ClampedText } from './ClampedText';
import { isAired } from './seasons';

function Still({ episode }: { episode: EpisodeSummary }) {
  const src = tmdbImage(episode.stillPath, 'w300');
  return (
    <div className="border-ink-600 bg-ink-800 aspect-video w-full shrink-0 overflow-hidden rounded-lg border sm:w-52">
      {src ? (
        <img
          src={src}
          srcSet={stillSrcSet(episode.stillPath)}
          // Full card width on mobile (container 32px + card padding 32px + borders 2px), 13rem beside the text from sm.
          sizes="(min-width: 640px) 13rem, calc(100vw - 66px)"
          alt=""
          width={300}
          height={169}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <div
          data-testid="still-placeholder"
          aria-hidden="true"
          className="font-display text-ivory-muted grid size-full place-items-center text-3xl"
        >
          E{episode.episodeNumber}
        </div>
      )}
    </div>
  );
}

/**
 * Episodes of one season. `renderAction` is the per-episode slot (e.g. mark as watched) and receives whether the
 * episode has aired; `renderSeasonActions` renders above the list with the numbers of the aired episodes.
 */
export function EpisodeList({
  season,
  renderAction,
  renderSeasonActions,
}: {
  season: SeasonDetails;
  renderAction?: (episode: EpisodeSummary, aired: boolean) => ReactNode;
  renderSeasonActions?: (season: SeasonDetails, airedEpisodeNumbers: number[]) => ReactNode;
}) {
  if (season.episodes.length === 0) {
    return <EmptyState title="Ainda não há episódios cadastrados." />;
  }
  const today = saoPauloIsoDate();
  const airedNumbers = season.episodes
    .filter((ep) => isAired(ep.airDate, today))
    .map((ep) => ep.episodeNumber);
  return (
    <>
      {renderSeasonActions ? renderSeasonActions(season, airedNumbers) : null}
      <ol className="space-y-4 font-sans">
        {season.episodes.map((ep) => {
          const date = formatDate(ep.airDate);
          // Future dated episodes get the premiere badge; undated ones show "Data a definir".
          const upcoming = ep.airDate !== null && !isAired(ep.airDate, today);
          const runtime = formatRuntime(ep.runtime);
          return (
            <li
              key={ep.episodeNumber}
              className="border-ink-700 bg-ink-900 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row"
            >
              <Still episode={ep} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="font-display text-ivory text-xl">{`E${ep.episodeNumber} · ${ep.name}`}</h3>
                  {upcoming ? (
                    <span className="bg-amber text-ink-950 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                      Estreia {date}
                    </span>
                  ) : null}
                </div>
                <p className="text-ivory-muted flex flex-wrap gap-x-3 text-sm">
                  {upcoming ? null : <span>{date ?? 'Data a definir'}</span>}
                  {runtime ? <span>{runtime}</span> : null}
                </p>
                {ep.overview ? <ClampedText text={ep.overview} /> : null}
                {renderAction ? <div>{renderAction(ep, isAired(ep.airDate, today))}</div> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
