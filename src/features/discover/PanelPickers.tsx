import { Check } from 'lucide-react';
import { tmdbImage } from '@/features/tmdb/images';
import type { Genre, Provider } from '@/features/tmdb/types';
import { cn } from '@/lib/cn';
import { toggleClass } from './panel-styles';

const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export const PROVIDER_LIMIT = 12;

export function GenrePicker({
  genres,
  selected,
  onChange,
  labelledBy,
}: {
  genres: Genre[];
  selected: number[];
  onChange: (ids: number[]) => void;
  labelledBy: string;
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {genres.map((g) => (
        <button
          key={g.id}
          type="button"
          aria-pressed={selected.includes(g.id)}
          onClick={() => onChange(toggle(selected, g.id))}
          className={cn('h-11 px-4 md:h-9 md:px-3.5', toggleClass(selected.includes(g.id)))}
        >
          {g.name}
        </button>
      ))}
    </div>
  );
}

export function ProviderPicker({
  providers,
  selected,
  onChange,
  labelledBy,
}: {
  providers: Provider[];
  selected: number[];
  onChange: (ids: number[]) => void;
  labelledBy: string;
}) {
  return (
    <div>
      <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-6 gap-2">
        {providers.slice(0, PROVIDER_LIMIT).map((p) => {
          const on = selected.includes(p.id);
          const logo = tmdbImage(p.logoPath, 'w92');
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              aria-label={p.name}
              title={p.name}
              onClick={() => onChange(toggle(selected, p.id))}
              className={cn(
                'relative grid aspect-square w-full max-w-14 place-items-center rounded-xl border-2 p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber motion-reduce:transition-none',
                on ? 'border-amber' : 'border-transparent hover:border-ink-600',
              )}
            >
              {logo ? (
                <img src={logo} alt="" width={48} height={48} loading="lazy" className="size-full rounded-lg" />
              ) : (
                <span aria-hidden="true" className="grid size-full place-items-center rounded-lg bg-ink-800 text-xs text-ivory-muted">
                  {p.name.slice(0, 2)}
                </span>
              )}
              {on ? (
                <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-amber text-ink-950">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="mt-4 font-sans text-xs text-ivory-muted">Dados de streaming fornecidos por JustWatch.</p>
    </div>
  );
}
