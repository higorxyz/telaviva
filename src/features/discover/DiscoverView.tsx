'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ActiveChips } from './ActiveChips';
import { activeChips, clearFilters } from './chips';
import { DiscoverResults } from './DiscoverResults';
import { filtersToSearchParams } from './filters';
import { FiltersPanel } from './FiltersPanel';
import { FiltersSheet } from './FiltersSheet';
import type { DiscoverCatalog } from './labels';
import { useDiscoverFilters } from './useDiscoverFilters';
import { useSidebarCollapsed } from './useSidebarCollapsed';

/** Filters live in the URL; the grid remounts (new key) whenever the applied filters change. */
export function DiscoverView({ catalog }: { catalog: DiscoverCatalog }) {
  const { applied, draft, setDraft, apply, resetDraft } = useDiscoverFilters(catalog);
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  // new Date() is safe here: the route is prerendered, and this client subtree sits behind Suspense because
  // useSearchParams bails out of the static shell, so it only ever renders in the browser.
  const maxYear = new Date().getFullYear() + 1;
  const chips = activeChips(applied, catalog);

  const panel = (after?: () => void) => (
    <FiltersPanel
      draft={draft}
      onChange={setDraft}
      catalog={catalog}
      maxYear={maxYear}
      onApply={() => {
        apply(draft);
        after?.();
      }}
    />
  );

  return (
    <div className="flex items-start gap-8">
      {collapsed ? null : (
        <aside
          aria-label="Filtros de busca"
          className="sticky top-24 hidden max-h-[calc(100dvh-7rem)] w-72 shrink-0 overflow-y-auto pr-2 md:block"
        >
          {panel()}
        </aside>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center gap-3">
          <FiltersSheet count={chips.length} onDismiss={resetDraft}>{(close) => panel(close)}</FiltersSheet>
          <button
            type="button"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
            className="hidden h-9 items-center gap-2 rounded-full border border-ivory/35 px-4 text-sm text-ivory hover:border-ivory/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber md:inline-flex"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-4" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-4" />
            )}
            {collapsed ? 'Mostrar filtros' : 'Ocultar filtros'}
          </button>
        </div>
        <ActiveChips
          chips={chips}
          onRemove={(chip) => apply(chip.next)}
          onClear={() => apply(clearFilters(applied))}
        />
        <DiscoverResults
          key={filtersToSearchParams(applied).toString()}
          filters={applied}
          onClear={chips.length ? () => apply(clearFilters(applied)) : undefined}
        />
      </div>
    </div>
  );
}
