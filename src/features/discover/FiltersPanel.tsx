import { Button } from '@/ui/Button';
import { switchMedia } from './chips';
import type { DiscoverFilters } from './filters';
import type { DiscoverCatalog } from './labels';
import { LanguageSelect, MediaToggle, SortSelect, VotesSelect, YearSelects } from './PanelFields';
import { GenrePicker, ProviderPicker } from './PanelPickers';
import { RatingSlider, RuntimeSlider } from './PanelSliders';

export function FiltersPanel({
  draft,
  onChange,
  catalog,
  maxYear,
  onApply,
}: {
  draft: DiscoverFilters;
  onChange: (f: DiscoverFilters) => void;
  catalog: DiscoverCatalog;
  maxYear: number;
  onApply: () => void;
}) {
  const patch = (p: Partial<DiscoverFilters>) => onChange({ ...draft, ...p });
  return (
    <form
      aria-label="Filtros"
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
      className="flex flex-col gap-6"
    >
      <MediaToggle value={draft.media} onChange={(m) => onChange(switchMedia(draft, m, catalog))} />
      <GenrePicker genres={catalog.genres[draft.media]} selected={draft.genres} onChange={(genres) => patch({ genres })} />
      <YearSelects f={draft} patch={patch} maxYear={maxYear} />
      <RatingSlider f={draft} patch={patch} />
      <VotesSelect f={draft} patch={patch} />
      {draft.media === 'movie' ? <RuntimeSlider f={draft} patch={patch} /> : null}
      <LanguageSelect f={draft} patch={patch} />
      <ProviderPicker
        providers={catalog.providers[draft.media]}
        selected={draft.providers}
        onChange={(providers) => patch({ providers })}
      />
      <SortSelect f={draft} patch={patch} />
      <div className="sticky bottom-0 -mx-1 bg-ink-900 px-1 py-3">
        <Button type="submit" variant="primary" className="w-full">
          Aplicar
        </Button>
      </div>
    </form>
  );
}
