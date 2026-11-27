import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { FilterChip } from './chips';

export function ActiveChips({
  chips,
  onRemove,
  onClear,
}: {
  chips: FilterChip[];
  onRemove: (chip: FilterChip) => void;
  onClear: () => void;
}) {
  const region = useRef<HTMLDivElement>(null);
  /** Index of the removed chip (or -1 after "Limpar tudo"), consumed once the chips re-render. */
  const pending = useRef<number | null>(null);
  const keys = chips.map((c) => c.key).join(',');

  useEffect(() => {
    if (pending.current === null) return;
    const index = pending.current;
    pending.current = null;
    const buttons = region.current?.querySelectorAll<HTMLButtonElement>('button[data-chip-remove]');
    // Next chip takes the removed one's slot; otherwise the previous; otherwise the region itself.
    const target = buttons && buttons.length && index >= 0 ? buttons[Math.min(index, buttons.length - 1)] : region.current;
    target?.focus();
  }, [keys]);

  return (
    <div ref={region} role="group" aria-label="Filtros ativos" tabIndex={-1} className="outline-none">
      {chips.length > 0 ? (
        <ul className="mb-6 flex flex-wrap items-center gap-2">
          {chips.map((chip, i) => (
            <li key={chip.key}>
              <span className="inline-flex h-9 items-center gap-1 rounded-full border border-ink-600 bg-ink-800 pr-1 pl-4 text-sm text-ivory">
                {chip.label}
                <button
                  type="button"
                  data-chip-remove=""
                  aria-label={`Remover filtro ${chip.label}`}
                  onClick={() => {
                    pending.current = i;
                    onRemove(chip);
                  }}
                  className="grid size-7 place-items-center rounded-full text-ivory-muted hover:text-ivory focus-visible:outline-2 focus-visible:outline-amber"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </span>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                pending.current = -1;
                onClear();
              }}
              className="h-9 px-3 text-sm text-ivory-muted underline hover:text-ivory focus-visible:outline-2 focus-visible:outline-amber"
            >
              Limpar tudo
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
