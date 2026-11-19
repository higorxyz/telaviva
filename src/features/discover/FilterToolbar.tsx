'use client';

import { useLayoutEffect, useState, type ReactNode } from 'react';
import { switchMedia } from './chips';
import type { DiscoverFilters } from './filters';
import { FilterMenu, type MenuContext } from './FilterMenu';
import { formatScore, type DiscoverCatalog } from './labels';
import { LanguageSelect, MediaToggle, Segmented, SortSelect, VotesSelect, YearSelects } from './PanelFields';
import { GenrePicker, ProviderPicker } from './PanelPickers';
import { toggleClass } from './panel-styles';
import { clearDimension, flip, isOn, RATING_STEPS, RUNTIME_STEPS, summary, yearPicks, type Dimension } from './toolbar-model';

type Update = (next: DiscoverFilters, options?: { now?: boolean }) => void;

/** Steps plus the current value when it is not one of them (old links, the "Curtos" preset), so it shows as picked. */
function steps<T extends number>(base: readonly T[], current: number | undefined, label: (n: number) => string) {
  const values: number[] = current !== undefined && !base.includes(current as T) ? [...base, current].sort((a, b) => a - b) : [...base];
  return [{ value: undefined, label: 'Qualquer' }, ...values.map((n) => ({ value: n as number | undefined, label: label(n) }))];
}

/**
 * Discover toolbar: type, one popover per filter dimension, sort. Every pick applies right away (toggles settle
 * for a moment first); nothing waits for an "Aplicar".
 */
export function FilterToolbar({
  filters: f,
  update,
  catalog,
  year,
  maxYear,
}: {
  filters: DiscoverFilters;
  update: Update;
  catalog: DiscoverCatalog;
  year: number;
  maxYear: number;
}) {
  const [open, setOpen] = useState<Dimension | null>(null);
  const patch = (p: Partial<DiscoverFilters>) => update({ ...f, ...p });
  const now = (p: Partial<DiscoverFilters>) => update({ ...f, ...p }, { now: true });

  // Popovers are transient: closed when the route comes back from an <Activity> hide.
  useLayoutEffect(() => () => setOpen(null), []);

  const menu = (dim: Dimension, label: string, body: (ctx: MenuContext) => ReactNode) => (
    <FilterMenu
      label={label}
      summary={summary(dim, f)}
      open={open === dim}
      onOpenChange={(o) => setOpen(o ? dim : null)}
      onClear={() => update(clearDimension(dim, f), { now: true })}
    >
      {body}
    </FilterMenu>
  );

  const providers = catalog.providers[f.media];

  return (
    // Mobile: one edge-to-edge scrolling row (padding keeps focus rings inside the clip). md+: wraps if needed.
    <div
      role="search"
      aria-label="Filtros"
      className="-mx-4 -my-1 flex items-center gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <MediaToggle value={f.media} onChange={(m) => update(switchMedia(f, m, catalog), { now: true })} />
      <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-ink-600" />
      {menu('generos', 'Gêneros', ({ titleId }) => (
        <GenrePicker genres={catalog.genres[f.media]} selected={f.genres} onChange={(genres) => patch({ genres })} labelledBy={titleId} />
      ))}
      {menu('ano', 'Ano', ({ close, titleId }) => (
        <div className="space-y-5">
          <YearSelects f={f} patch={patch} maxYear={maxYear} />
          <div role="group" aria-labelledby={titleId} className="flex flex-wrap gap-2">
            {yearPicks(year).map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={isOn(f, p)}
                onClick={() => {
                  update(flip(f, p), { now: true });
                  close();
                }}
                className={`h-11 px-4 md:h-9 md:px-3.5 ${toggleClass(isOn(f, p))}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {menu('nota', 'Nota', ({ close, titleId }) => (
        <Segmented
          labelledBy={titleId}
          className="max-md:w-full"
          options={steps(RATING_STEPS, f.minRating, (n) => `${formatScore(n)}+`)}
          value={f.minRating}
          onChange={(minRating) => {
            now({ minRating });
            close();
          }}
        />
      ))}
      {f.media === 'movie'
        ? menu('duracao', 'Duração', ({ close, titleId }) => (
            <Segmented
              labelledBy={titleId}
              className="max-md:w-full max-md:flex-wrap max-md:rounded-3xl"
              options={steps(RUNTIME_STEPS, f.maxRuntime, (n) => `Até ${n} min`)}
              value={f.maxRuntime}
              onChange={(maxRuntime) => {
                now({ maxRuntime });
                close();
              }}
            />
          ))
        : null}
      {providers.length > 0
        ? menu('provedores', 'Onde assistir', ({ titleId }) => (
            <ProviderPicker providers={providers} selected={f.providers} onChange={(ids) => patch({ providers: ids })} labelledBy={titleId} />
          ))
        : null}
      {menu('mais', 'Mais', () => (
        <div className="space-y-4">
          <LanguageSelect f={f} patch={patch} />
          <VotesSelect f={f} patch={patch} />
        </div>
      ))}
      <div className="shrink-0 md:ml-auto">
        <SortSelect f={f} patch={(p) => now(p)} />
      </div>
    </div>
  );
}
