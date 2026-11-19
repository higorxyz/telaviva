'use client';

import { GridSkeleton } from '@/features/catalog/GridSkeleton';
import { Skeleton } from '@/ui/Skeleton';
import { useLibrary } from '../hooks';
import { LibraryEmpty } from './LibraryEmpty';
import { LibraryGrid } from './LibraryGrid';
import { libraryStats, selectItems, TABS, type LibraryTab } from './library-query';
import { LibraryStats } from './LibraryStats';
import { LibraryTabs, panelId, tabId } from './LibraryTabs';
import { LibraryToolbar } from './LibraryToolbar';
import { useLibraryQuery } from './useLibraryQuery';
import { useTvProgress } from './useTvProgress';

export function LibrarySkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="mb-10 h-24 w-full" />
      <Skeleton className="mb-6 h-12 w-full" />
      <GridSkeleton count={12} />
    </div>
  );
}

export function LibraryView() {
  const { state, ready } = useLibrary();
  const hasWatching = state?.items.some((i) => i.status === 'watching') ?? false;
  const [query, update] = useLibraryQuery(hasWatching);
  const items = state ? selectItems(state, query) : [];
  // Only the tabs that show progress ask TMDb for it.
  const tvIds =
    query.aba === 'quero-ver' ? [] : items.filter((i) => i.mediaType === 'tv').map((i) => i.tmdbId);
  const progress = useTvProgress(tvIds);

  // The server and the first client render know nothing about the library: skeleton, never a flash of "vazia".
  if (!ready || !state) return <LibrarySkeleton />;

  const counts = Object.fromEntries(
    TABS.map((t) => [t, selectItems(state, { aba: t, tipo: null, ordem: 'recentes' }).length]),
  ) as Record<LibraryTab, number>;

  return (
    <>
      {state.items.length > 0 ? <LibraryStats stats={libraryStats(state)} /> : null}
      <LibraryTabs active={query.aba} counts={counts} onChange={(aba) => update({ aba })} />
      <LibraryToolbar
        tipo={query.tipo}
        ordem={query.ordem}
        showType={query.aba !== 'assistindo'}
        onType={(tipo) => update({ tipo })}
        onOrder={(ordem) => update({ ordem })}
      />
      <div role="tabpanel" id={panelId(query.aba)} aria-labelledby={tabId(query.aba)}>
        {items.length > 0 ? (
          <LibraryGrid items={items} state={state} tab={query.aba} progress={progress} />
        ) : (
          <LibraryEmpty tab={query.aba} />
        )}
      </div>
    </>
  );
}
