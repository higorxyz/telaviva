import { useId } from 'react';
import { tmdbImage } from '@/features/tmdb/images';
import type { Genre, Provider } from '@/features/tmdb/types';
import { LABEL_CLASS, toggleClass } from './panel-styles';

const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export const PROVIDER_LIMIT = 12;

export function GenrePicker({
  genres,
  selected,
  onChange,
}: {
  genres: Genre[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <span id={id} className={LABEL_CLASS}>Gêneros</span>
      <div className="flex flex-wrap gap-2">
        {genres.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={selected.includes(g.id)}
            onClick={() => onChange(toggle(selected, g.id))}
            className={`h-9 px-3.5 ${toggleClass(selected.includes(g.id))}`}
          >
            {g.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProviderPicker({
  providers,
  selected,
  onChange,
}: {
  providers: Provider[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <span id={id} className={LABEL_CLASS}>Onde assistir (Brasil)</span>
      <div className="flex flex-wrap gap-2">
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
              className={`grid size-12 place-items-center overflow-hidden p-0.5 ${toggleClass(on)} ${on ? 'ring-2 ring-amber' : ''}`}
            >
              {logo ? (
                <img src={logo} alt="" width={44} height={44} loading="lazy" className="size-11 rounded-full" />
              ) : (
                <span aria-hidden="true" className="text-xs">{p.name.slice(0, 2)}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 font-sans text-xs text-ivory-muted">Dados de streaming fornecidos por JustWatch.</p>
    </div>
  );
}
