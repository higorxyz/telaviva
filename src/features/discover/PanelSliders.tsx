import { useId } from 'react';
import { RUNTIME_MAX, RUNTIME_MIN, type DiscoverFilters } from './filters';
import { formatDecimal } from './labels';

type Patch = (p: Partial<DiscoverFilters>) => void;

function Slider({
  label,
  display,
  valueText,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  display: string;
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ivory">
          {label}
        </label>
        <output htmlFor={id} className="text-sm text-amber">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full accent-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      />
    </div>
  );
}

export function RatingSlider({ f, patch }: { f: DiscoverFilters; patch: Patch }) {
  const v = f.minRating ?? 0;
  return (
    <Slider
      label="Nota mínima"
      display={v ? `${formatDecimal(v)}+` : 'Qualquer'}
      valueText={v ? `${formatDecimal(v)} ou mais` : 'Qualquer nota'}
      min={0}
      max={10}
      step={0.5}
      value={v}
      onChange={(n) => patch({ minRating: n || undefined })}
    />
  );
}

/** Movies only. The maximum position means "no limit". */
export function RuntimeSlider({ f, patch }: { f: DiscoverFilters; patch: Patch }) {
  const v = f.maxRuntime ?? RUNTIME_MAX;
  const unlimited = v >= RUNTIME_MAX;
  return (
    <Slider
      label="Duração máxima"
      display={unlimited ? 'Qualquer' : `até ${v} min`}
      valueText={unlimited ? 'Qualquer duração' : `até ${v} minutos`}
      min={RUNTIME_MIN}
      max={RUNTIME_MAX}
      step={5}
      value={v}
      onChange={(n) => patch({ maxRuntime: n >= RUNTIME_MAX ? undefined : n })}
    />
  );
}
