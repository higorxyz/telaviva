import { cn } from '@/lib/cn';
import type { DiscoverFilters } from './filters';
import { toggleClass } from './panel-styles';
import { flip, isOn, presets } from './toolbar-model';

/** One-tap starting points; each is pressed while the current filters match it, and a second tap undoes it. */
export function Presets({
  filters,
  year,
  onChange,
}: {
  filters: DiscoverFilters;
  year: number;
  onChange: (next: DiscoverFilters) => void;
}) {
  const visible = presets(year).filter((p) => !p.movieOnly || filters.media === 'movie');
  return (
    <div
      role="group"
      aria-label="Atalhos"
      className="-mx-4 -my-1 flex items-center gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <span aria-hidden="true" className="shrink-0 pr-1 text-sm text-ivory-muted">
        Atalhos
      </span>
      {visible.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={isOn(filters, p)}
          onClick={() => onChange(flip(filters, p))}
          className={cn('h-11 shrink-0 px-4 md:h-9', toggleClass(isOn(filters, p)))}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
