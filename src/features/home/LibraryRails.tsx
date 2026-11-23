'use client';

import { useMemo } from 'react';
import { Rail } from '@/features/catalog/Rail';
import { findRating } from '@/features/library/commands';
import { useLibrary } from '@/features/library/hooks';
import { seriesProgress, type TvProgressInfo } from '@/features/library/progress';
import { nextEpisodeLabel, toSummary } from '@/features/library/summary';
import type { LibraryItem, LibraryState } from '@/features/library/types';
import { useRecommendations } from '@/features/library/useRecommendations';
import { useTvProgress } from '@/features/library/view/useTvProgress';

const MIN_RECOMMENDATIONS = 6;

function continueWatching(
  state: LibraryState,
  progress: Record<string, TvProgressInfo>,
): { item: LibraryItem; next: string }[] {
  const rows: { item: LibraryItem; next: string; at: number }[] = [];
  for (const item of state.items) {
    if (item.mediaType !== 'tv' || item.status !== 'watching') continue;
    const info = progress[String(item.tmdbId)];
    if (!info) continue;
    const result = seriesProgress(info, state.episodes.filter((e) => e.tvId === item.tmdbId));
    if (result.kind !== 'in-progress') continue;
    rows.push({ item, next: nextEpisodeLabel(result.next), at: Date.parse(item.updatedAt) || 0 });
  }
  // updatedAt is the latest activity: every episode mark goes through the reducer, which refreshes it.
  return rows.sort((a, b) => b.at - a.at);
}

/**
 * Personal rails of the home page. They render nothing until the library has loaded (and nothing for an empty
 * one), so a new visitor sees no skeleton and the server-rendered rails never wait for it.
 */
export function LibraryRails() {
  const { state, ready } = useLibrary();
  const watchingIds = state
    ? state.items.filter((i) => i.mediaType === 'tv' && i.status === 'watching').map((i) => i.tmdbId)
    : [];
  const progress = useTvProgress(watchingIds);
  const recommendations = useRecommendations();

  const continuing = useMemo(() => (state ? continueWatching(state, progress) : []), [state, progress]);
  const continueItems = useMemo(() => continuing.map((c) => toSummary(c.item)), [continuing]);

  if (!ready || !state || (state.items.length === 0 && state.ratings.length === 0)) return null;

  const subtitles = new Map(continuing.map((c) => [c.item.tmdbId, c.next]));
  // The threshold applies to the server's answer: saving titles from the rail hides them without dropping the rail.
  const showRecommendations =
    recommendations.ready && recommendations.total >= MIN_RECOMMENDATIONS && recommendations.items.length > 0;

  return (
    <>
      {continueItems.length > 0 ? (
        <Rail
          id="continue-assistindo"
          title={{ lead: 'Continue', accent: 'assistindo' }}
          href="/minha-lista?aba=assistindo"
          items={continueItems}
          subtitleOf={(item) => subtitles.get(item.id)}
          ringOf={(item) => ({
            value: findRating(state, { mediaType: 'tv', tmdbId: item.id })?.score ?? null,
            tone: 'personal',
          })}
        />
      ) : null}
      {showRecommendations ? (
        <Rail id="recomendados" title={{ lead: 'Recomendados', accent: 'para você' }} items={recommendations.items} />
      ) : null}
    </>
  );
}
