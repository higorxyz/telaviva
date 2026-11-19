import type { ReactNode } from 'react';
import { saoPauloIsoDate } from '@/features/tmdb/dates';
import { tmdbImage } from '@/features/tmdb/images';
import type { EpisodeSummary, SeasonDetails } from '@/features/tmdb/types';
import { formatDate, formatRuntime } from '@/lib/format';
import { EmptyState } from '@/ui/EmptyState';
import { ClampedText } from './ClampedText';
import { isAired } from './seasons';

function Still({ episode }: { episode: EpisodeSummary }) {
  const src = tmdbImage(episode.stillPath, 'w300');
  return (
    <div className="aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-800 sm:w-52">
      {src ? (
        <img
          src={src}
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
          className="grid size-full place-items-center font-display text-3xl text-ivory-muted"
        >
          E{episode.episodeNumber}
        </div>
      )}
    </div>
  );
}

/** Episodes of one season. `renderAction` is the per-episode slot (e.g. mark as watched). */
export function EpisodeList({
  season,
  renderAction,
}: {
  season: SeasonDetails;
  renderAction?: (episode: EpisodeSummary) => ReactNode;
}) {
  if (season.episodes.length === 0) {
    return <EmptyState title="Ainda não há episódios cadastrados." />;
  }
  const today = saoPauloIsoDate();
  return (
    <ol className="space-y-4 font-sans">
      {season.episodes.map((ep) => {
        const date = formatDate(ep.airDate);
        // Future dated episodes get the premiere badge; undated ones show "Data a definir".
        const upcoming = ep.airDate !== null && !isAired(ep.airDate, today);
        const runtime = formatRuntime(ep.runtime);
        return (
          <li
            key={ep.episodeNumber}
            className="flex flex-col gap-4 rounded-xl border border-ink-700 bg-ink-900 p-4 sm:flex-row"
          >
            <Still episode={ep} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="font-display text-xl text-ivory">{`E${ep.episodeNumber} · ${ep.name}`}</h3>
                {upcoming ? (
                  <span className="rounded-full bg-amber px-2.5 py-0.5 text-xs font-semibold text-ink-950">
                    Estreia {date}
                  </span>
                ) : null}
              </div>
              <p className="flex flex-wrap gap-x-3 text-sm text-ivory-muted">
                {upcoming ? null : <span>{date ?? 'Data a definir'}</span>}
                {runtime ? <span>{runtime}</span> : null}
              </p>
              {ep.overview ? <ClampedText text={ep.overview} /> : null}
              {renderAction ? <div>{renderAction(ep)}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
