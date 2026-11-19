'use client';

import { ActiveChips } from './ActiveChips';
import { activeChips, clearFilters } from './chips';
import { DiscoverResults } from './DiscoverResults';
import { filtersToSearchParams } from './filters';
import { FilterToolbar } from './FilterToolbar';
import type { DiscoverCatalog } from './labels';
import { Presets } from './Presets';
import { useDiscoverFilters } from './useDiscoverFilters';

/**
 * Results first, refined in a tap or two: presets, a sticky toolbar of one-dimension popovers, the active chips,
 * then the full-width grid. Filters live in the URL; the grid remounts (new key) whenever the applied set changes.
 */
export function DiscoverView({ catalog }: { catalog: DiscoverCatalog }) {
  const { filters, applied, update } = useDiscoverFilters(catalog);
  // new Date() is safe here: the route is prerendered, and this client subtree sits behind Suspense because
  // useSearchParams bails out of the static shell, so it only ever renders in the browser.
  const year = new Date().getFullYear();
  const chips = activeChips(filters, catalog);
  const clear = () => update(clearFilters(filters), { now: true });

  return (
    <div>
      <Presets filters={filters} year={year} onChange={(next) => update(next, { now: true })} />
      <div className="sticky top-16 z-30 -mx-4 mt-3 bg-ink-950 px-4 py-3 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-linear-to-b after:from-ink-950 after:to-transparent sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <FilterToolbar filters={filters} update={update} catalog={catalog} year={year} maxYear={year + 1} />
      </div>
      <div className="mt-4">
        <ActiveChips chips={chips} onRemove={(chip) => update(chip.next, { now: true })} onClear={clear} />
      </div>
      <DiscoverResults
        key={filtersToSearchParams(applied).toString()}
        filters={applied}
        onClear={activeChips(applied, catalog).length ? clear : undefined}
      />
    </div>
  );
}
