import { X } from 'lucide-react';
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
  if (chips.length === 0) return null;
  return (
    <ul aria-label="Filtros ativos" className="mb-6 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <span className="inline-flex h-9 items-center gap-1 rounded-full border border-ink-600 bg-ink-800 pr-1 pl-4 text-sm text-ivory">
            {chip.label}
            <button
              type="button"
              aria-label={`Remover filtro ${chip.label}`}
              onClick={() => onRemove(chip)}
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
          onClick={onClear}
          className="h-9 px-3 text-sm text-ivory-muted underline underline-offset-4 hover:text-ivory focus-visible:outline-2 focus-visible:outline-amber"
        >
          Limpar tudo
        </button>
      </li>
    </ul>
  );
}
