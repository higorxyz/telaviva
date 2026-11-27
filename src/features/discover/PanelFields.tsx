import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SORTS, type DiscoverFilters, type DiscoverSort } from './filters';
import { LANGUAGES, SORT_LABELS, VOTE_OPTIONS, formatVotes } from './labels';
import { LABEL_CLASS, SEGMENTED_CLASS, SELECT_CLASS, segmentClass } from './panel-styles';

type Patch = (p: Partial<DiscoverFilters>) => void;

/** Single choice as pressed buttons (aria-pressed), e.g. Filmes | Séries or Qualquer · 6+ · 7+ · 8+. */
export function Segmented<T extends string | number | undefined>({
  label,
  labelledBy,
  options,
  value,
  onChange,
  className,
}: {
  label?: string;
  labelledBy?: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} aria-labelledby={labelledBy} className={cn(SEGMENTED_CLASS, className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={segmentClass(value === o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MediaToggle({ value, onChange }: { value: DiscoverFilters['media']; onChange: (m: 'movie' | 'tv') => void }) {
  return (
    <Segmented
      label="Tipo"
      options={[
        { value: 'movie', label: 'Filmes' },
        { value: 'tv', label: 'Séries' },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

function Select({
  label,
  value,
  onChange,
  children,
  inline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  inline?: boolean;
}) {
  const id = useId();
  return (
    <div className={inline ? 'flex shrink-0 items-center gap-2' : undefined}>
      <label htmlFor={id} className={inline ? 'text-sm whitespace-nowrap text-ivory-muted' : LABEL_CLASS}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(SELECT_CLASS, inline && 'w-auto')}>
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
      <Select label="De" value={String(f.yearFrom ?? '')} onChange={(v) => patch({ yearFrom: toNum(v) })}>
        {options}
      </Select>
      <Select label="Até" value={String(f.yearTo ?? '')} onChange={(v) => patch({ yearTo: toNum(v) })}>
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
    <Select label="Ordenar por" inline value={f.sort} onChange={(v) => patch({ sort: v as DiscoverSort })}>
      {sorts.map((s) => (
        <option key={s} value={s}>
          {SORT_LABELS[s]}
        </option>
      ))}
    </Select>
  );
}
