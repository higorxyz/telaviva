import { GRID_CLASS, GRID_SIZES } from '@/features/catalog/GridSkeleton';
import { PosterCard } from '@/features/catalog/PosterCard';
import type { MediaSummary } from '@/features/tmdb/types';
import { findRating } from '../commands';
import { episodeCode, seriesProgress, type TvProgressInfo } from '../progress';
import type { LibraryItem, LibraryState } from '../types';
import type { LibraryTab } from './library-query';

/** A minimal summary built from the saved snapshot, so the list never calls TMDb for its posters. */
export function toSummary(item: LibraryItem): MediaSummary {
  return {
    id: item.tmdbId,
    mediaType: item.mediaType,
    title: item.snapshot.title,
    originalTitle: item.snapshot.title,
    overview: '',
    posterPath: item.snapshot.posterPath,
    backdropPath: null,
    voteAverage: 0,
    voteCount: 0,
    popularity: 0,
    releaseDate: item.snapshot.releaseDate,
    genreIds: item.snapshot.genreIds,
    originalLanguage: '',
  };
}

/** Progress line when TMDb data is at hand; undefined falls back to the year. */
function progressSubtitle(
  tab: LibraryTab,
  item: LibraryItem,
  state: LibraryState,
  info: TvProgressInfo | undefined,
): string | undefined {
  if (item.mediaType !== 'tv' || !info) return undefined;
  const progress = seriesProgress(
    info,
    state.episodes.filter((e) => e.tvId === item.tmdbId),
  );
  if (tab === 'assistindo') {
    if (progress.kind === 'in-progress') return `Próximo: ${episodeCode(progress.next)}`;
    if (progress.kind === 'caught-up') return 'Em dia';
  }
  if (tab === 'assistidos' && progress.kind === 'in-progress') return 'Novos episódios';
  return undefined;
}

export function LibraryGrid({
  items,
  state,
  tab,
  progress,
}: {
  items: LibraryItem[];
  state: LibraryState;
  tab: LibraryTab;
  progress: Record<string, TvProgressInfo>;
}) {
  return (
    <ul className={GRID_CLASS}>
      {items.map((item, i) => (
        <li key={`${item.mediaType}:${item.tmdbId}`}>
          <PosterCard
            item={toSummary(item)}
            sizes={GRID_SIZES}
            priority={i < 6}
            ringValue={findRating(state, item)?.score ?? null}
            ringTone="personal"
            subtitle={progressSubtitle(tab, item, state, progress[String(item.tmdbId)])}
          />
        </li>
      ))}
    </ul>
  );
}
