import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SORTS, type DiscoverFilters, type DiscoverSort } from './filters';
import { LANGUAGES, SORT_LABELS, VOTE_OPTIONS, formatVotes } from './labels';
import { LABEL_CLASS, SELECT_CLASS, toggleClass } from './panel-styles';

type Patch = (p: Partial<DiscoverFilters>) => void;

export function MediaToggle({
  value,
  onChange,
}: {
  value: DiscoverFilters['media'];
  onChange: (m: 'movie' | 'tv') => void;
}) {
  return (
    <div role="group" aria-label="Tipo" className="grid grid-cols-2 gap-1 rounded-full border border-ink-600 bg-ink-800 p-1">
      {(['movie', 'tv'] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={value === m}
          onClick={() => onChange(m)}
          className={cn('h-9', toggleClass(value === m))}
        >
          {m === 'movie' ? 'Filme' : 'Série'}
        </button>
      ))}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLASS}>
        {children}
      </select>
    </div>
  );
}

const toNum = (v: string) => (v === '' ? undefined : Number(v));

export function YearSelects({ f, patch, maxYear }: { f: DiscoverFilters; patch: Patch; maxYear: number }) {
  const top = Math.max(maxYear, f.yearFrom ?? 0, f.yearTo ?? 0);
  const years = Array.from({ length: top - 1900 + 1 }, (_, i) => top - i);
  const options = (
    <>
      <option value="">Qualquer</option>
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      <Select label="Ano de" value={String(f.yearFrom ?? '')} onChange={(v) => patch({ yearFrom: toNum(v) })}>
        {options}
      </Select>
      <Select label="Ano até" value={String(f.yearTo ?? '')} onChange={(v) => patch({ yearTo: toNum(v) })}>
        {options}
      </Select>
    </div>
  );
}

export function VotesSelect({ f, patch }: { f: DiscoverFilters; patch: Patch }) {
  const current = f.minVotes ?? 0;
  const base: number[] = [...VOTE_OPTIONS];
  const values = base.includes(current) ? base : [...base, current].sort((a, b) => a - b);
  return (
    <Select label="Votos mínimos" value={String(current)} onChange={(v) => patch({ minVotes: Number(v) || undefined })}>
      {values.map((n) => (
        <option key={n} value={n}>
          {n === 0 ? 'Qualquer' : `${formatVotes(n)}+`}
        </option>
      ))}
    </Select>
  );
}

export function LanguageSelect({ f, patch }: { f: DiscoverFilters; patch: Patch }) {
  const unknown = f.language && !LANGUAGES.some((l) => l.code === f.language) ? f.language : null;
  return (
    <Select label="Idioma original" value={f.language ?? ''} onChange={(v) => patch({ language: v || undefined })}>
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
      {unknown ? <option value={unknown}>{unknown}</option> : null}
    </Select>
  );
}

export function SortSelect({ f, patch }: { f: DiscoverFilters; patch: Patch }) {
  const sorts = f.media === 'tv' ? SORTS.filter((s) => s !== 'bilheteria') : SORTS;
  return (
    <Select label="Ordenar por" value={f.sort} onChange={(v) => patch({ sort: v as DiscoverSort })}>
      {sorts.map((s) => (
        <option key={s} value={s}>
          {SORT_LABELS[s]}
        </option>
      ))}
    </Select>
  );
}
