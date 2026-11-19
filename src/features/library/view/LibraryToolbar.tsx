'use client';

import { useId } from 'react';
import { SEGMENTED_CLASS, SELECT_CLASS, segmentClass } from '@/features/discover/panel-styles';
import type { MediaType } from '@/features/tmdb/types';
import type { LibraryOrder } from './library-query';

const TYPES: { value: MediaType | null; label: string }[] = [
  { value: null, label: 'Todos' },
  { value: 'movie', label: 'Filmes' },
  { value: 'tv', label: 'Séries' },
];
const ORDERS: { value: LibraryOrder; label: string }[] = [
  { value: 'recentes', label: 'Recentes' },
  { value: 'titulo', label: 'Título' },
  { value: 'nota', label: 'Sua nota' },
  { value: 'ano', label: 'Ano' },
];

export function LibraryToolbar({
  tipo,
  ordem,
  showType,
  onType,
  onOrder,
}: {
  tipo: MediaType | null;
  ordem: LibraryOrder;
  showType: boolean;
  onType: (t: MediaType | null) => void;
  onOrder: (o: LibraryOrder) => void;
}) {
  const id = useId();
  return (
    <div className="my-6 flex flex-wrap items-center justify-between gap-4">
      {showType ? (
        <div role="group" aria-label="Tipo" className={SEGMENTED_CLASS}>
          {TYPES.map((t) => (
            <button
              key={t.label}
              type="button"
              aria-pressed={tipo === t.value}
              onClick={() => onType(t.value)}
              className={segmentClass(tipo === t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-3">
        <label htmlFor={id} className="shrink-0 text-sm whitespace-nowrap text-ivory-muted">
          Ordenar por
        </label>
        <select
          id={id}
          value={ordem}
          onChange={(e) => onOrder(e.target.value as LibraryOrder)}
          className={`${SELECT_CLASS} w-auto`}
        >
          {ORDERS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
