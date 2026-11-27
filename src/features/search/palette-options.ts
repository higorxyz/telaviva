import { formatYear } from '@/lib/format';
import { departmentLabel } from '@/lib/people';
import { mediaHref, personHref } from '@/lib/slug';
import type { SearchItem } from '@/features/tmdb/types';

export const MAX_OPTIONS = 8;

export interface PaletteOption {
  id: string;
  href: string;
  label: string;
  hint: string;
  image: string | null;
  round: boolean;
}

export interface PaletteGroup {
  label: string;
  options: PaletteOption[];
}

const GROUPS: { type: SearchItem['mediaType']; label: string }[] = [
  { type: 'movie', label: 'Filmes' },
  { type: 'tv', label: 'Séries' },
  { type: 'person', label: 'Pessoas' },
];

function toOption(item: SearchItem, id: string): PaletteOption {
  if (item.mediaType === 'person') {
    return {
      id,
      href: personHref(item),
      label: item.name,
      hint: item.knownForDepartment ? departmentLabel(item.knownForDepartment) : 'Pessoa',
      image: item.profilePath,
      round: true,
    };
  }
  return { id, href: mediaHref(item), label: item.title, hint: formatYear(item.releaseDate) ?? '', image: item.posterPath, round: false };
}

/** Groups items by type (Filmes, Séries, Pessoas), keeping at most MAX_OPTIONS in total. */
export function groupResults(items: SearchItem[], idPrefix: string): PaletteGroup[] {
  let index = 0;
  const groups: PaletteGroup[] = [];
  for (const { type, label } of GROUPS) {
    const options: PaletteOption[] = [];
    for (const item of items.filter((i) => i.mediaType === type)) {
      if (index >= MAX_OPTIONS) break;
      options.push(toOption(item, `${idPrefix}-${item.mediaType}-${item.id}`));
      index++;
    }
    if (options.length > 0) groups.push({ label, options });
  }
  return groups;
}
