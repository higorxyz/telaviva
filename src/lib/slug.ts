export function toSlug(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'titulo' : slug;
}

export function parseIdFromSlug(slug: string): number | null {
  const match = /^(\d+)(?:-|$)/.exec(slug);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

type MediaType = 'movie' | 'tv';

export function mediaHref(m: { mediaType: MediaType; id: number; title: string }): string {
  return `/${m.mediaType === 'movie' ? 'filme' : 'serie'}/${m.id}-${toSlug(m.title)}`;
}

export function personHref(p: { id: number; name: string }): string {
  return `/pessoa/${p.id}-${toSlug(p.name)}`;
}

export function genreHref(g: { mediaType: MediaType; id: number; name: string }): string {
  return `/genero/${g.mediaType === 'movie' ? 'filme' : 'serie'}/${g.id}-${toSlug(g.name)}`;
}
