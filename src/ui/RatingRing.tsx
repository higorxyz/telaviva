import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { formatRating } from '@/lib/format';

type Size = 'sm' | 'md' | 'lg';
type Tone = 'tmdb' | 'personal';

const sizes: Record<Size, string> = {
  sm: 'size-[30px] text-[10px]',
  md: 'size-11 text-sm',
  lg: 'size-14 text-base',
};

const ringColor: Record<Tone, string> = {
  tmdb: 'var(--color-amber)',
  personal: 'var(--color-ivory)',
};

export function RatingRing({
  value,
  size = 'md',
  tone = 'tmdb',
  className,
}: {
  value: number | null;
  size?: Size;
  tone?: Tone;
  className?: string;
}) {
  const hasValue = typeof value === 'number' && Number.isFinite(value) && value > 0;
  const clamped = hasValue ? Math.min(10, value) : 0;
  const text = hasValue ? formatRating(clamped) : '–';
  const label = !hasValue
    ? 'Sem nota'
    : `${tone === 'personal' ? 'Sua nota' : 'Nota'} ${text} de 10`;

  const style = {
    '--pct': `${clamped * 10}%`,
    '--ring': ringColor[tone],
    background:
      'conic-gradient(var(--ring) var(--pct), color-mix(in oklab, var(--color-ivory) 14%, transparent) 0)',
  } as CSSProperties;

  return (
    <span
      role="img"
      aria-label={label}
      style={style}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full p-[3px] font-sans font-semibold text-ivory tabular-nums',
        sizes[size],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-full place-items-center rounded-full bg-ink-900"
      >
        {text}
      </span>
    </span>
  );
}
